import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as pathjs from 'path'
import { type JSONSchema, type ImportOptions } from './schema'
import { MINECRAFT_REGISTRY, checkIfRegistryNeedsUpdate } from './minecraftRegistries'
import { MDFile } from './mdReader'
import * as chokidar from 'chokidar'
import prettier from 'prettier'
import terminalkit from 'terminal-kit'
import { marked } from 'marked'
const TERM = terminalkit.terminal

const DEV_FLAG = !!process.argv.find(v => v === '--dev')
const BUILD_ONCE_FLAG = !!process.argv.find(v => v === '--once')

console.log('DEV_FLAG:', DEV_FLAG)
console.log('BUILD_ONCE_FLAG:', BUILD_ONCE_FLAG)

const SRC_DIR = 'src/schemas/'.replace(/\//g, pathjs.sep)
const OUT_DIR = 'schemas/'.replace(/\//g, pathjs.sep)

let prettierConfig: prettier.Options

function collectPropertyObjects(
	schema: JSONSchema,
	objects: Array<NonNullable<(JSONSchema & { type: 'object' })['properties']>>,
) {
	if (Array.isArray(schema)) {
		for (const item of schema as JSONSchema[]) {
			collectPropertyObjects(item, objects)
		}
	} else if (typeof schema === 'object') {
		if (schema.properties) {
			objects.push(schema.properties)
		}
		for (const val of Object.values(schema) as JSONSchema[]) {
			collectPropertyObjects(val, objects)
		}
	}
	return objects
}

async function processSchemaProperties(schema: JSONSchema, path: string) {
	let mdFile: MDFile | undefined
	let url: string | undefined
	if (schema.$localDocsUrl) {
		try {
			mdFile = await MDFile.fromFile(schema.$localDocsUrl).fetchContent()
			url = schema.$localDocsUrl
		} catch (e: any) {
			TERM.brightRed(`Failed to read '${schema.$docsUrl}':\n  ${e}\n`)
		}
	} else if (schema.$docsUrl) {
		try {
			mdFile = await MDFile.fromDocsURL(schema.$docsUrl).fetchContent()
			url = schema.$docsUrl
		} catch (e: any) {
			TERM.brightRed(`Failed to read '${schema.$docsUrl}':\n  ${e}\n`)
		}
	} else {
		return
	}
	if (!mdFile || !url) return

	const propertyObjects = collectPropertyObjects(schema, [])

	let ignoredProperties: string[] = []
	if (Array.isArray(schema.$IGNORED_PROPERTIES)) {
		ignoredProperties = schema.$IGNORED_PROPERTIES
		delete schema.$IGNORED_PROPERTIES
	}

	if (mdFile.description) {
		if (schema.$INCLUDE_MDFILE_DESCRIPTION) {
			schema.description ??= ''
			schema.description += ['## ' + mdFile.title, mdFile.description, mdFile.examples].join(
				'\n\n---\n\n',
			)
			schema.markdownDescription ??= ''
			schema.markdownDescription += [
				'## ' + mdFile.title,
				mdFile.description,
				mdFile.examples,
			].join('\n\n---\n\n')
			schema['x-intellij-html-description'] = await marked(mdFile.content)
		}
		if (
			!ignoredProperties.includes('type') &&
			(url.match(/.+(?:action|condition|power)_types/) ||
				// Epoli uses a worse naming convention :(
				url.match(/.+(?:action|condition|powertype)s/))
		) {
			schema.properties ??= {}
			const typeObj = (schema.properties.type ??= {})
			typeObj.description ??= ''
			typeObj.description += ['## ' + mdFile.title, mdFile.description, mdFile.examples].join(
				'\n\n---\n\n',
			)
			typeObj.markdownDescription ??= ''
			typeObj.markdownDescription += [
				'## ' + mdFile.title,
				mdFile.description,
				mdFile.examples,
			].join('\n\n---\n\n')
			schema['x-intellij-html-description'] = await marked(mdFile.content)
		}
	}

	if (mdFile.fields.length > 0) {
		if (schema.type !== 'object' && propertyObjects.length < 1) {
			TERM.brightRed('Schema ')
				.brightYellow(path)
				.brightRed(' is not an object, but has fields in ')
				.brightYellow(mdFile.path)('\n')
		}
		const foundFields: string[] = [...ignoredProperties]
		for (const propObj of propertyObjects) {
			for (const field of mdFile.fields) {
				if (!propObj[field.name] || ignoredProperties.includes(field.name)) continue
				foundFields.push(field.name)

				const fieldObj = propObj[field.name]
				fieldObj.description ??= ''
				fieldObj.description += field.description
				fieldObj.markdownDescription ??= ''
				fieldObj.markdownDescription += field.description
				if (field.depreciated) {
					const depreciatedPrefix = '#### 🚨 Depreciated 🚨\n\n'
					fieldObj.description = depreciatedPrefix + fieldObj.description
					fieldObj.markdownDescription = depreciatedPrefix + fieldObj.markdownDescription
				}
			}
		}
		for (const field of mdFile.fields) {
			if (!foundFields.includes(field.name)) {
				TERM.brightRed('Field ')
					.brightYellow(field.name)
					.brightRed(' is missing from ')
					.brightYellow(path)('\n')
			}
		}
	}
	delete schema.$docsUrl
}

function processImportFilesIntoArray(
	layer: JSONSchema,
	options: ProcessSchemaOptions,
	importOptions: ImportOptions & { type: 'import_files_into_array' },
) {
	const path = SRC_DIR + importOptions.path.replace(/\$ref\((.+)\)/, '$1').replace(':', '/')
	const stringStructure = JSON.stringify(importOptions.schema_structure)

	if (layer[importOptions.output_key] === undefined) {
		throw new Error(
			`$IMPORT: output_key '${importOptions.output_key}' not found in schema:\n  ${JSON.stringify(
				layer,
			)}`,
		)
	}

	let files: string[] = []
	try {
		files = fsSync.readdirSync(path).filter(f => f.endsWith('.json'))
	} catch (e: any) {
		throw new Error(`Failed to process $IMPORT while trying to read directory:\n  ${e}`)
	}

	for (const file of files) {
		const fileName = file.replace('.json', '')
		if (importOptions.exclude?.includes(fileName)) continue
		const outFilePath = (path + '/' + file).replace(SRC_DIR, OUT_DIR)
		const refPath = pathjs
			.relative(pathjs.dirname(options.outPath), outFilePath)
			.replace(/\\/g, '/')
		const structure = stringStructure
			.replace(/\$fileRef/g, refPath)
			.replace(/\$fileName/g, fileName)

		layer[importOptions.output_key].push(JSON.parse(structure))
	}

	layer.$IMPORT = undefined
}

async function processImportFileContentsIntoArray(
	layer: JSONSchema,
	options: ProcessSchemaOptions,
	importOptions: ImportOptions & { type: 'import_file_contents_into_array' },
) {
	const path = SRC_DIR + importOptions.path.replace(/\$ref\((.+)\)/, '$1').replace(':', '/')
	const stringStructure = JSON.stringify(importOptions.schema_structure)

	if (layer[importOptions.output_key] === undefined) {
		throw new Error(
			`$IMPORT: output_key '${importOptions.output_key}' not found in schema:\n  ${JSON.stringify(
				layer,
			)}`,
		)
	}

	let files: string[] = []
	try {
		files = fsSync.readdirSync(path).filter(f => f.endsWith('.json'))
	} catch (e: any) {
		throw new Error(`Failed to process $IMPORT while trying to read directory:\n  ${e}`)
	}
	const variables: Array<[string, string]> = []
	if (importOptions.variables && Object.keys(importOptions.variables).length > 0) {
		variables.push(...Object.entries(importOptions.variables))
		variables.sort((a, b) => a[0].length - b[0].length)
	}

	for (const file of files) {
		const fileName = file.replace('.json', '')
		if (importOptions.exclude?.includes(fileName)) continue
		const inFilePath = path + '/' + file
		const outFilePath = inFilePath.replace(SRC_DIR, OUT_DIR)
		// const childRefPath = pathjs
		// 	.relative(pathjs.dirname(options.outPath), outFilePath)
		// 	.replace(/\\/g, '/')
		// const parentRefPath = pathjs
		// 	.relative(pathjs.dirname(outFilePath), options.outPath)
		// 	.replace(/\\/g, '/')

		const fileContents: JSONSchema = JSON.parse(fsSync.readFileSync(inFilePath, 'utf-8'))
		await processSchema(fileContents, {
			schemaPath: inFilePath,
			outPath: outFilePath,
		})
		await processSchemaProperties(fileContents, inFilePath)

		let fileStrContents = JSON.stringify(fileContents)
		for (const [name, value] of variables) {
			// console.log(name, value, `$${name}`)
			fileStrContents = fileStrContents.replaceAll(`$${name}`, value)
		}

		const structure = stringStructure
			.replace(/"\$fileRef"/gm, fileStrContents)
			.replace(/\$fileName/g, fileName)

		layer[importOptions.output_key].push(JSON.parse(structure))
	}

	layer.$IMPORT = undefined
}

function processImportMinecraftRegistry(
	layer: JSONSchema,
	options: ProcessSchemaOptions,
	importOptions: ImportOptions & { type: 'import_minecraft_registry' },
) {
	if (layer[importOptions.output_key] === undefined) {
		throw new Error(
			`$IMPORT: output_key '${importOptions.output_key}' not found in schema:\n  ${JSON.stringify(
				layer,
			)}`,
		)
	}

	const registry = MINECRAFT_REGISTRY[importOptions.registry_key as keyof typeof MINECRAFT_REGISTRY]
	if (!registry) {
		console.log(MINECRAFT_REGISTRY)
		throw new Error(`Minecraft registry key '${importOptions.registry_key}' not found`)
	}

	for (const item of registry.items) {
		const structure = JSON.stringify(importOptions.schema_structure)
			.replace(/\$item/g, item)
			.replace(/\$registryKey/g, importOptions.registry_key)

		layer[importOptions.output_key].push(JSON.parse(structure))
	}

	layer.$IMPORT = undefined
}

async function processImport(
	layer: JSONSchema,
	options: ProcessSchemaOptions,
	importOptions: ImportOptions,
) {
	switch (importOptions.type) {
		case 'import_files_into_array':
			processImportFilesIntoArray(layer, options, importOptions)
			break
		case 'import_file_contents_into_array':
			await processImportFileContentsIntoArray(layer, options, importOptions)
			break
		case 'import_minecraft_registry':
			processImportMinecraftRegistry(layer, options, importOptions)
			break
		default:
			// @ts-ignore
			throw new Error(`Unknown $IMPORT type: ${importOptions.type}`)
	}
}

async function processSchemaLayer(layer: JSONSchema, options: ProcessSchemaOptions) {
	if (layer.$IMPORT) {
		if (Array.isArray(layer.$IMPORT)) {
			for (const importOptions of layer.$IMPORT) {
				await processImport(layer, options, importOptions)
			}
		} else {
			await processImport(layer, options, layer.$IMPORT)
		}
	}
	delete layer.$schema
}

interface ProcessSchemaOptions {
	schemaPath: string
	outPath: string
}

async function processSchema(schema: JSONSchema, options: ProcessSchemaOptions) {
	if (Array.isArray(schema)) {
		for (const item of schema as JSONSchema[]) {
			await processSchema(item, options)
		}
	} else if (typeof schema === 'object') {
		await processSchemaLayer(schema, options)
		for (const val of Object.values(schema) as JSONSchema[]) {
			await processSchema(val, options)
		}
	}
}

async function build(schemasToBuild: string[]) {
	TERM.brightGreen('Building schemas...\n')
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	let buildProgress: terminalkit.Terminal.ProgressBarController | undefined
	if (!process.argv.includes('--workflow') && !(schemasToBuild.length < 10)) {
		buildProgress = TERM.progressBar({
			items: schemasToBuild.length,
			percent: true,
			eta: true,
			syncMode: true,
		})
	}
	const fileIOQueue: Array<{ path: string; content: string }> = []

	for (const schemaPath of schemasToBuild) {
		buildProgress?.startItem(schemaPath)
		if (!fsSync.existsSync(schemaPath)) {
			buildProgress?.itemDone(schemaPath)
			continue
		}
		const outPath = schemaPath.replace(SRC_DIR, OUT_DIR)
		// const fileName = pathjs.basename(outPath)
		// term.brightCyan(`\nProcessing `).brightBlue(fileName).gray(` (${outPath})`)('\n')

		const contents: JSONSchema = await fs.readFile(schemaPath, 'utf-8').then(JSON.parse)

		await processSchema(contents, { schemaPath, outPath })
		await processSchemaProperties(contents, schemaPath)

		let strContents = JSON.stringify(contents)
		strContents = strContents.replace(/\$ref\((.+?)\)/gm, substring => {
			substring = substring.slice(5, -1)
			const srcPath = SRC_DIR + substring.replace(':', pathjs.sep) + '.json'
			let subOutPath = srcPath.replace(SRC_DIR, OUT_DIR)

			if (!fsSync.existsSync(srcPath)) {
				TERM.brightRed('Unknown schema ')
					.brightRed('$ref(')
					.brightYellow(substring)
					.brightRed(') referenced in ')
					.brightYellow(schemaPath)('\n')
				return substring
			}

			subOutPath = pathjs.relative(pathjs.dirname(outPath), subOutPath)
			return pathjs.normalize(subOutPath).replace(/\\/g, '/')
		})

		fileIOQueue.push({ path: outPath, content: strContents })
		buildProgress?.itemDone(schemaPath)
	}
	buildProgress?.stop()

	TERM.brightGreen('Writing files...\n')
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	let writeProgress: terminalkit.Terminal.ProgressBarController | undefined
	if (!process.argv.includes('--workflow') && !(fileIOQueue.length < 10)) {
		writeProgress = TERM.progressBar({
			items: fileIOQueue.length,
			percent: true,
			eta: true,
			syncMode: true,
		})
	}

	for (const { path, content } of fileIOQueue) {
		writeProgress?.startItem(path)
		await fs.mkdir(pathjs.dirname(path), { recursive: true })
		if (DEV_FLAG) {
			await fs.writeFile(path, await prettier.format(content, prettierConfig))
		} else {
			await fs.writeFile(path, content)
		}
		writeProgress?.itemDone(path)
	}

	writeProgress?.stop()
}

async function loadPrettierConfig() {
	const config = await prettier.resolveConfig(process.cwd(), { config: '.prettierrc.json' })
	if (!config) {
		throw new Error(`Failed to load prettier config.`)
	}
	prettierConfig = config
	prettierConfig.parser = 'json'
}

async function main() {
	await loadPrettierConfig()
	await checkIfRegistryNeedsUpdate()

	if (BUILD_ONCE_FLAG) {
		const schemasToBuild: string[] = []
		async function recurse(path: string) {
			for (const file of await fs.readdir(path)) {
				const filePath = pathjs.join(path, file)
				if (filePath.endsWith('.json')) {
					schemasToBuild.push(filePath)
				} else if ((await fs.stat(filePath)).isDirectory()) {
					await recurse(filePath)
				}
			}
		}
		await recurse(SRC_DIR)
		// Clean old build results
		await fs.rm(OUT_DIR, { recursive: true }).catch(() => {})
		await fs.mkdir(OUT_DIR, { recursive: true }).catch(() => {})

		await build(schemasToBuild)
		return
	}

	const watcher = chokidar.watch(SRC_DIR)
	const deleteQueue: string[] = []
	const buildQueue: string[] = []
	watcher
		.on('add', path => {
			if (path.endsWith('.json')) {
				buildQueue.push(path)
			}
		})
		.on('change', path => {
			if (path.endsWith('.json')) {
				buildQueue.push(path)
			}
		})
		.on('unlink', path => {
			if (path.endsWith('.json')) {
				const outPath = path.replace(SRC_DIR, OUT_DIR)
				if (fsSync.existsSync(outPath)) {
					deleteQueue.push(outPath)
				}
			}
		})

	let working = false
	let lastBuildErrored = false

	async function checkQueue() {
		if (working) return
		working = true

		if (deleteQueue.length > 0) {
			const path = deleteQueue.shift()!
			TERM.brightRed('Deleting ').brightYellow(path)('\n')
			await fs.unlink(path)
			TERM.brightGreen('Watching for changes...\n')
		}

		if (buildQueue.length > 0) {
			const paths = buildQueue.splice(0)

			if (lastBuildErrored) {
				for (const [dir, files] of Object.entries(watcher.getWatched())) {
					for (const file of files) {
						if (file.endsWith('.json')) {
							paths.push(pathjs.join(dir, file))
						}
					}
				}
				lastBuildErrored = false
			}

			await build(paths)
				.then(() => {
					TERM.brightGreen('Watching for changes...\n')
				})
				.catch(e => {
					TERM.brightRed('Failed to build schemas:\n  ').brightRed(e)('\n').brightRed(e.stack)('\n')
					lastBuildErrored = true
				})
				.finally(() => {
					working = false
				})
		}

		working = false
	}

	setInterval(() => {
		void checkQueue()
	}, 500)
}

void main()
