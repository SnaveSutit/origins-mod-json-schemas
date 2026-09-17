import * as fs from 'fs'
import * as pathjs from 'path'
import Ajv from 'ajv'
import terminalkit from 'terminal-kit'
const TERM = terminalkit.terminal

const OUT_DIR = 'schemas'
const BUNDLED_DIR = pathjs.join(OUT_DIR, 'bundled')
// Files under these dirs are $IMPORT templates: the build inlines their contents into
// dispatcher schemas (entity_action.json, etc.), string-replacing `$actionRef`/`$conditionRef`
// placeholders per consumer. Standalone, those placeholders are unresolved by design.
const TEMPLATE_DIR_NAMES = ['meta_action_types', 'meta_condition_types']
// Ajv's URI resolver mishandles multi-level `../../` traversal against scheme-less
// relative $ids, so every $id gets this synthetic absolute base to resolve against.
const ID_BASE = 'https://schemas.internal/'

function findJSONFiles(dir: string): string[] {
	const files: string[] = []
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = pathjs.join(dir, entry.name)
		if (entry.isDirectory()) {
			files.push(...findJSONFiles(fullPath))
		} else if (entry.name.endsWith('.json')) {
			files.push(fullPath)
		}
	}
	return files
}

interface ValidationError {
	path: string
	message: string
}

/**
 * Validates every schema under `schemas/` (excluding `schemas/bundled/`) both against the
 * draft-07 meta-schema and for resolvable $refs. Each file's $id is set to its path relative
 * to `schemas/`, so the same relative $refs the build produces (eg. `../types/key.json`)
 * resolve exactly as they would for a real consumer walking the tree on disk.
 */
function validateSourceSchemas(files: string[]): ValidationError[] {
	const errors: ValidationError[] = []
	const ajv = new Ajv({ strict: false, allErrors: true })

	const schemas: Array<{ path: string; id: string; schema: any }> = []
	for (const path of files) {
		const relId = pathjs.relative(OUT_DIR, path).replace(/\\/g, '/')
		let schema: any
		try {
			schema = JSON.parse(fs.readFileSync(path, 'utf-8'))
		} catch (e: any) {
			errors.push({ path, message: `Invalid JSON: ${e.message}` })
			continue
		}
		const id = ID_BASE + relId
		schema.$id = id
		schemas.push({ path, id, schema })
	}

	for (const { path, id, schema } of schemas) {
		try {
			ajv.addSchema(schema)
		} catch (e: any) {
			errors.push({ path, message: e.message })
		}
	}

	for (const { path, id } of schemas) {
		try {
			ajv.getSchema(id)
		} catch (e: any) {
			errors.push({ path, message: e.message })
		}
	}

	return errors
}

/**
 * Bundled schemas are meant to be fully self-contained (only local `#/...` pointers, no
 * cross-file $refs), so each one is compiled in isolation and checked for stray external refs.
 */
function validateBundledSchemas(files: string[]): ValidationError[] {
	const errors: ValidationError[] = []

	for (const path of files) {
		const content = fs.readFileSync(path, 'utf-8')
		let schema: any
		try {
			schema = JSON.parse(content)
		} catch (e: any) {
			errors.push({ path, message: `Invalid JSON: ${e.message}` })
			continue
		}

		for (const match of content.matchAll(/"\$ref"\s*:\s*"([^"]+)"/g)) {
			if (!match[1].startsWith('#')) {
				errors.push({
					path,
					message: `Bundled schema has a non-local $ref, it should be fully self-contained: "${match[1]}"`,
				})
			} else if (match[1].endsWith('/')) {
				// A trailing slash adds a final empty-string pointer token (RFC 6901), so eg. "#/"
				// points at root[""], not root - Ajv resolves it leniently anyway, but VS Code's
				// JSON language service treats it as unresolvable and drops validation entirely.
				errors.push({
					path,
					message: `$ref "${match[1]}" has a trailing slash - not a valid JSON Pointer to the intended target`,
				})
			}
		}

		const ajv = new Ajv({ strict: false, allErrors: true })
		try {
			ajv.compile(schema)
		} catch (e: any) {
			errors.push({ path, message: e.message })
		}
	}

	return errors
}

function main() {
	if (!fs.existsSync(OUT_DIR)) {
		TERM.brightRed(`'${OUT_DIR}/' does not exist. Run the build first.\n`)
		process.exit(1)
	}

	const allFiles = findJSONFiles(OUT_DIR)
	const bundledFiles = allFiles.filter(f => f.startsWith(BUNDLED_DIR + pathjs.sep))
	const sourceFiles = allFiles
		.filter(f => !f.startsWith(BUNDLED_DIR + pathjs.sep))
		.filter(f => !TEMPLATE_DIR_NAMES.includes(pathjs.basename(pathjs.dirname(f))))

	TERM.brightGreen(`Validating `).brightBlue(String(sourceFiles.length)).brightGreen(` schemas...\n`)
	const sourceErrors = validateSourceSchemas(sourceFiles)

	TERM.brightGreen(`Validating `)
		.brightBlue(String(bundledFiles.length))
		.brightGreen(` bundled schemas...\n`)
	const bundledErrors = validateBundledSchemas(bundledFiles)

	const errors = [...sourceErrors, ...bundledErrors]

	if (errors.length > 0) {
		TERM.brightRed(`\n${errors.length} schema(s) failed validation:\n\n`)
		for (const { path, message } of errors) {
			TERM.brightYellow(path)(': ').brightRed(message)('\n')
		}
		process.exit(1)
	}

	TERM.brightGreen(
		`\nAll ${sourceFiles.length} schemas and ${bundledFiles.length} bundled schemas are valid.\n`,
	)
}

main()
