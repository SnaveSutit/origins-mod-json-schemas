import * as fs from 'fs/promises'
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

export async function bundleSchemas(outDir: string) {
	const bundledDir = pathjs.join(outDir, 'bundled')
	await fs.rm(bundledDir, { recursive: true, force: true })
	await fs.mkdir(bundledDir, { recursive: true })

	for (const [sourceRelPath, outputFile] of Object.entries(BUNDLE_ENTRY_POINTS)) {
		const sourcePath = pathjs.join(outDir, sourceRelPath)
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
}
