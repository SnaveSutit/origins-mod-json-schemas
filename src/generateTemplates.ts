import * as fs from 'fs'
import { MDFile, apugliDocsUrl, epoliDocsUrl, originsDocsUrl, skillfulDocsUrl } from './mdReader'
import { JSONSchema, SimpleSchemaType } from './schema'
// import pathjs from 'path'
import terminalkit from 'terminal-kit'
const TERM = terminalkit.terminal
const OUT_DIR = './.generated'

interface IModule {
	name: string
	docsUrl: string
	localDocsPath: string
	ignored?: string[]
}

const GLOBAL_IGNORED = [
	'misc',
	'guides',
	'index.md',
	'bientity_action_types.md',
	'bientity_condition_types.md',
	'biome_condition_types.md',
	'block_action_types.md',
	'block_condition_types.md',
	'damage_condition_types.md',
	'data_types.md',
	'entity_action_types.md',
	'entity_condition_types.md',
	'fluid_condition_types.md',
	'item_action_types.md',
	'item_condition_types.md',
]

const MODULES: IModule[] = [
	{
		name: 'apoli',
		docsUrl: originsDocsUrl,
		localDocsPath: 'D:/github-repos/origins-docs/docs',
		ignored: [...GLOBAL_IGNORED],
	},
	{
		name: 'apugli',
		docsUrl: apugliDocsUrl,
		localDocsPath: 'D:/github-repos/apugli-docs/docs',
		ignored: [...GLOBAL_IGNORED],
	},
	{
		name: 'epoli',
		docsUrl: epoliDocsUrl,
		localDocsPath: 'D:/github-repos/epoli-docs/docs',
		ignored: [...GLOBAL_IGNORED, 'redstone.md', 'powertypes.md'],
	},
	// {
	// 	name: 'eggolib',
	// 	docsUrl: eggolibDocsUrl,
	// 	localDocsPath: 'D:/github-repos/eggolib-docs/docs',
	// 	ignored: [...GLOBAL_IGNORED],
	// },
	{
		name: 'skillful',
		docsUrl: skillfulDocsUrl,
		localDocsPath: 'D:/github-repos/skillful_docs/docs',
		ignored: [...GLOBAL_IGNORED, 'key.md'],
	},
]

function attemptToMapType(
	name: string,
	property: NonNullable<JSONSchema['properties']>[string],
	mdFile: MDFile,
) {
	// This is just for getting rid of red squiggles
	if (Array.isArray(property.type)) {
		TERM.brightRed('Found array type while attempting to map type. This should not happen.')
		return
	}

	const field = mdFile.getField(name)
	let type = property.type?.toLowerCase()
	if (!type) return
	let match: RegExpMatchArray | null
	let plural = false

	if (name.endsWith('s')) {
		const singular = mdFile.getField(name.slice(0, -1))
		if (singular) {
			plural = true
			name = name.slice(0, -1)
			type = singular.type.toLowerCase()
		}
	}

	if (name === 'entity_type' || name === 'entity_id') {
		if (type.includes('identifier')) {
			name = name.toLowerCase()
			delete property.type
			property.$ref = '$ref(apoli:types/autocomplete_helpers/entity_identifier)'
		}
	} else if (name === 'tag') {
		if (type.includes('nbt') || field?.description.includes('NBT')) {
			delete property.type
			property.$ref = '$ref(apoli:types/nbt)'
		} else {
			delete property.type
			property.$ref = '$ref(apoli:types/identifier)'
		}
	} else if (name === 'key') {
		if (type.includes('key')) {
			delete property.type
			property.$ref = '$ref(apoli:types/key)'
		}
	} else if (name === 'particle') {
		if (type.includes('particle effect')) {
			delete property.type
			property.$ref = '$ref(apoli:types/particle_effect)'
		} else if (type.includes('identifier')) {
			delete property.type
			property.$ref = '$ref(apoli:types/autocomplete_helpers/particle_identifier)'
		}
	} else if (name === 'sound') {
		if (type.includes('identifier')) {
			delete property.type
			property.$ref = '$ref(apoli:types/autocomplete_helpers/sound_identifier)'
		} else if (type.includes('weighted sound event')) {
			delete property.type
			property.$ref = '$ref(apugli:types/weighted_sound_event)'
		}
	} else if (name === 'effect') {
		if (type.includes('identifier')) {
			delete property.type
			property.$ref = '$ref(apoli:types/autocomplete_helpers/status_effect_identifier)'
		}
	} else if (name === 'damage_type') {
		if (type.includes('identifier')) {
			delete property.type
			property.$ref = '$ref(apoli:types/damage_source)'
		}
	} else if (name === 'shape') {
		if (type === 'string') {
			delete property.type
			property.$ref = '$ref(apoli:types/shape)'
		}
	} else if (name === 'space') {
		if (type === 'string') {
			delete property.type
			property.$ref = '$ref(apoli:types/space)'
		}
	} else if (name === 'side') {
		if (type === 'string') {
			delete property.type
			property.$ref = '$ref(apoli:types/side)'
		}
	} else if (name === 'texture_location') {
		if (type.includes('identifier')) {
			delete property.type
			property.$ref = '$ref(apoli:types/autocomplete_helpers/texture_location)'
		}
	} else if (name === 'hud_render') {
		if (type.includes('hud render')) {
			delete property.type
			property.$ref = '$ref(apoli:types/hud_render)'
		}
	} else if (name === 'slot') {
		if (type === 'string') {
			delete property.type
			property.$ref = '$ref(apoli:types/slot)'
		}
	} else if (
		(match = name.match(/(bientity|entity|block|damage|item|fluid|biome)_(action|condition)/)) ||
		(match = type.match(/(bientity|entity|block|damage|item|fluid|biome)[_ ](action|condition)/))
	) {
		delete property.type
		property.$ref = `$ref(apoli:${match[0].replaceAll(' ', '_')})`
	} else if (type.includes('identifier')) {
		delete property.type
		property.$ref = `$ref(apoli:types/identifier)`
	} else if (type === 'float' || type === 'double') {
		property.type = 'number'
		if (property.default) property.default = Number(property.default)
	} else if (type === 'int' || type === 'integer') {
		property.type = 'integer'
		if (property.default) property.default = Number(property.default)
	} else if (type === 'attribute modifier') {
		delete property.type
		property.$ref = `$ref(apoli:types/attribute_modifier)`
	} else if (type === 'space') {
		delete property.type
		property.$ref = `$ref(apoli:types/space)`
	} else if (type === 'boolean' && typeof property.default === 'string') {
		property.default = !(property.default === 'true')
	} else if (type === 'comparison') {
		delete property.type
		property.$ref = '$ref(apoli:types/comparison)'
	} else if (type === 'vector') {
		delete property.type
		property.$ref = '$ref(apoli:types/vector)'
	} else if (type.includes('food component')) {
		delete property.type
		property.$ref = '$ref(apoli:types/food_component)'
	} else if (type.includes('item stack')) {
		delete property.type
		property.$ref = '$ref(apoli:types/item_stack)'
	} else if (
		name === 'items' &&
		type === 'array' &&
		field?.subTypes.find(s => s.name.toLowerCase().match(/identifier|identifiers/))
	) {
		property.type = 'array'
		property.items = {
			$ref: '$ref(apoli:types/autocomplete_helpers/item_identifier)',
		}
	} else if (
		name === 'item_tags' &&
		type === 'array' &&
		field?.subTypes.find(s => s.name.toLowerCase().match(/identifier|identifiers/))
	) {
		property.type = 'array'
		property.items = {
			$ref: '$ref(apoli:types/identifier)',
		}
	} else if (type === 'string') {
		const matches = field?.description.matchAll(/`"?(.+?)"?`/g)
		if (matches) {
			const matchValues = [...matches]
			if (matchValues.length > 0) {
				const values: string[] = []
				for (const value of matchValues) {
					values.push(value[1])
				}
				property.enum = values
			}
		}
	}

	if (plural) {
		const oldProperty = JSON.parse(JSON.stringify(property))
		for (const key of Object.keys(property)) {
			delete property[key]
		}
		property.type = 'array'
		property.items = oldProperty
	}
}

function getAllMDFiles(path: string, files: string[] = [], ignored: string[] = []): string[] {
	for (const file of fs.readdirSync(path)) {
		const filePath = `${path}/${file}`
		if (ignored.includes(file)) continue
		if (fs.statSync(filePath).isDirectory()) {
			getAllMDFiles(filePath, files, ignored)
		} else {
			if (!file.endsWith('.md')) continue
			files.push(filePath)
		}
	}
	return files
}

function generateTemplates(module: IModule) {
	TERM.brightGreen(`Generating templates for ${module.name}...\n`)

	const files = getAllMDFiles(module.localDocsPath, [], module.ignored)

	for (const file of files) {
		let mdFile: MDFile
		try {
			mdFile = MDFile.fromFile(file)
		} catch (e: any) {
			TERM.brightRed(`Error parsing ${file}: \n  ${e.message}\n`)
			// TERM.brightRed(`Error parsing ${file}: \n  ${e.message}\n  ${e.stack}\n`)
			continue
		}
		const schema: JSONSchema = {
			$schema: 'https://json-schema.org/draft-07/schema#',
			$docsUrl:
				module.docsUrl +
				file.replace(module.localDocsPath, '').replace('.md', '/').replace(/^\//, ''),
		}
		if (mdFile.fields.length > 0) {
			schema.type = 'object'
			schema.$IGNORED_PROPERTIES = []
			schema.required = []
			schema.properties = {}
			for (const field of mdFile.fields) {
				const property: NonNullable<JSONSchema['properties']>[string] = {}
				property.type = field.type.toLowerCase() as SimpleSchemaType
				if (field.depreciated) {
					property.depreciated = true
				}
				if (!field.optional) {
					if (field.defaultValue === undefined) {
						schema.required.push(field.name)
					} else {
						property.default = field.defaultValue
					}
				}

				attemptToMapType(field.name, property, mdFile)

				schema.properties[field.name] = property
			}
			if (schema.required.length === 0) delete schema.required
			if (schema.$IGNORED_PROPERTIES.length === 0) delete schema.$IGNORED_PROPERTIES
		} else if (mdFile.values.length > 0) {
			schema.type = 'string'
			schema.enum = mdFile.values.map(v => v.value)
		}

		const outPath = file
			.replace(module.localDocsPath, OUT_DIR + '/' + module.name)
			.replace('.md', '.json')
		fs.mkdirSync(outPath.replace(/\/[^/]+$/, ''), { recursive: true })
		fs.writeFileSync(outPath, JSON.stringify(schema, null, '\t'))
	}
}

function main() {
	fs.rmSync(OUT_DIR, { recursive: true })
	fs.mkdirSync(OUT_DIR, { recursive: true })

	for (const module of MODULES) {
		generateTemplates(module)
	}
}

main()
