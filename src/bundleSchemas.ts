import * as fs from 'fs/promises'
import * as os from 'os'
import * as pathjs from 'path'
import refParser from '@apidevtools/json-schema-ref-parser'
import terminalkit from 'terminal-kit'
const TERM = terminalkit.terminal

/**
 * Bundles each entry point into one self-contained file (only local `#/...` refs, no
 * cross-file $refs). Needed because VS Code's local (file://) resolver mis-resolves
 * relative $refs once a dispatcher schema (allOf/if-then) has ~10+ branches, which most
 * of these schemas do (microsoft/vscode#7730, #92348).
 *
 * Uses dereference({ circular: true }) + decycle() below instead of ref-parser's own
 * bundle(), which produces dangling $refs on schemas with shared, self-recursive
 * sub-schemas like ours (APIDevTools/json-schema-ref-parser#338, #24).
 *
 * dereference() also merge-clones `$ref` nodes that have sibling keys (eg. our
 * `description`/`markdownDescription`/`default` VS Code hints), producing a second,
 * un-merged copy of the target for any *internal* self-refs to resolve against. For
 * recursive schemas like text_component.json this desyncs decycle()'s object-identity
 * cycle detection and corrupts the output. Wrapping `$ref` in a single-member `allOf`
 * sidesteps the merge (allOf has no special-cased handling), so bundling runs against a
 * rewritten copy of the schema tree rather than `outDir` itself.
 */

/** Entry-point schema (relative to the built `schemas/` dir) -> output filename under `schemas/bundled/`. */
export const BUNDLE_ENTRY_POINTS: Record<string, string> = {
	'apoli/origin.json': 'origin.json',
	'apoli/origin_layer.json': 'origin_layer.json',
	'apoli/badge.json': 'badge.json',
	'apoli/power.json': 'power.json',
	'apoli/global_power_set.json': 'global_power_set.json',
	'skillful/skill_tree_json.json': 'skill_tree_json.json',
	'skillful/keybinding.json': 'keybinding.json',
	'sync/keybind.json': 'sync_keybind.json',
}

/** Replaces object-identity cycles from dereference() with a `{ $ref }` to the first-visited path. */
function decycle(root: unknown): unknown {
	const seen = new Map<object, Array<string | number>>()

	function pointerFor(pathParts: Array<string | number>): string {
		if (pathParts.length === 0) {
			return '#'
		}
		return '#/' + pathParts.map(p => String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')
	}

	function walk(node: unknown, pathParts: Array<string | number>): unknown {
		if (node === null || typeof node !== 'object') {
			return node
		}
		if (seen.has(node)) {
			return { $ref: pointerFor(seen.get(node)!) }
		}
		seen.set(node, pathParts)
		if (Array.isArray(node)) {
			return node.map((item, i) => walk(item, [...pathParts, i]))
		}
		const out: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(node)) {
			out[key] = walk(value, [...pathParts, key])
		}
		return out
	}

	return walk(root, [])
}

/** Rewrites `{ $ref, ...siblings }` to `{ allOf: [{ $ref }], ...siblings }` so dereference() never sees a $ref with siblings. */
function wrapRefSiblings(node: unknown): unknown {
	if (node === null || typeof node !== 'object') {
		return node
	}
	if (Array.isArray(node)) {
		return node.map(wrapRefSiblings)
	}
	const obj = node as Record<string, unknown>
	if (typeof obj.$ref === 'string' && Object.keys(obj).length > 1) {
		const { $ref, ...siblings } = obj
		const out: Record<string, unknown> = { allOf: [{ $ref }] }
		for (const [key, value] of Object.entries(siblings)) {
			out[key] = wrapRefSiblings(value)
		}
		return out
	}
	const out: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(obj)) {
		out[key] = wrapRefSiblings(value)
	}
	return out
}

/** Copies `srcDir` to `destDir`, applying wrapRefSiblings() to every JSON file. */
async function copyWithRewrittenRefs(srcDir: string, destDir: string) {
	await fs.mkdir(destDir, { recursive: true })
	for (const entry of await fs.readdir(srcDir, { withFileTypes: true })) {
		const srcPath = pathjs.join(srcDir, entry.name)
		const destPath = pathjs.join(destDir, entry.name)
		if (entry.isDirectory()) {
			await copyWithRewrittenRefs(srcPath, destPath)
		} else if (entry.name.endsWith('.json')) {
			const schema = JSON.parse(await fs.readFile(srcPath, 'utf-8'))
			await fs.writeFile(destPath, JSON.stringify(wrapRefSiblings(schema)))
		}
	}
}

export async function bundleSchemas(outDir: string) {
	const bundledDir = pathjs.join(outDir, 'bundled')
	await fs.rm(bundledDir, { recursive: true, force: true })
	await fs.mkdir(bundledDir, { recursive: true })

	const preprocessedDir = await fs.mkdtemp(pathjs.join(os.tmpdir(), 'schema-bundle-src-'))
	try {
		await copyWithRewrittenRefs(outDir, preprocessedDir)

		for (const [sourceRelPath, outputFile] of Object.entries(BUNDLE_ENTRY_POINTS)) {
			const sourcePath = pathjs.join(preprocessedDir, sourceRelPath)
			const dereferenced = await refParser.dereference(sourcePath, {
				dereference: { circular: true },
			})
			const bundled = decycle(dereferenced)
			const outPath = pathjs.join(bundledDir, outputFile)
			await fs.writeFile(outPath, JSON.stringify(bundled, null, '\t') + '\n')
			TERM.brightGreen('Bundled ')
				.brightBlue(sourceRelPath)
				.brightGreen(' -> ')
				.brightBlue(pathjs.relative(outDir, outPath))('\n')
		}
	} finally {
		await fs.rm(preprocessedDir, { recursive: true, force: true })
	}
}
