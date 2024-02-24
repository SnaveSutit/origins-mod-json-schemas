// import { dataTypes } from './dataTypes'
import * as fs from 'fs'
import pathjs from 'path'
import terminalkit from 'terminal-kit'
const TERM = terminalkit.terminal

export const MODULES = {
	origins: {
		rawUrl: 'https://raw.githubusercontent.com/apace100/origins-docs/latest/docs/',
		docsUrl: 'https://origins.readthedocs.io/en/latest/',
	},
	apugli: {
		rawUrl: 'https://raw.githubusercontent.com/MerchantPug/apugli-docs/1.20/docs/',
		docsUrl: 'https://apugli.readthedocs.io/en/latest/',
	},
	epoli: {
		rawUrl: 'https://raw.githubusercontent.com/Exzotic5485/Epoli-Docs/main/docs/',
		docsUrl: 'https://epoli-docs.readthedocs.io/en/latest/',
	},
	eggolib: {
		rawUrl: 'RAW DOCS LINK MISSING',
		docsUrl: 'https://eggolib.github.io/latest/',
	},
	skillful: {
		rawUrl: 'https://raw.githubusercontent.com/ThatRobin/skillful_docs/main/docs/',
		docsUrl: 'https://skillful-docs.readthedocs.io/en/latest/',
	},
	moborigins: {
		rawUrl: 'https://raw.githubusercontent.com/UltrusBot/Mob-Origin-Docs/master/docs/',
		docsUrl: 'https://moborigins.ultrusmods.me/en/latest/',
	},
	// proviorigins: {
	// 	rawUrl: 'https://raw.githubusercontent.com/ThatRobin/ProviOrigins/main/docs/',
	// 	docsUrl: 'https://github.com/Provismet/Provi-Origins/wiki/',
	// },
}

const MD_LINK_REGEX = /\[(?<name>[^\n[]+?)\]\((?<target>[^\n ]+?)\)/g
const DESCRIPTION_REGEX = /^#+\s*(?<title>.+)\n(?<description>[^]+?)\s*###\s*.*$/gm
const LOOSE_DESCRIPTION_REGEX = /(?<description>[^]+?)\s*#{1,3}\s*.*$/gm
const FIELD_TITLE_REGEX =
	/\|?\s*Field\s*\|\s*Type\s*\|\s*Default\s*\|\s*Description\s*\|?\n(\|?\s*:?-+\s*)+\|?\n/gm
const FIELD_CAPTURE_REGEX =
	/^\|?\s*(?<field>[^|\n\s]+?)\s*\|\s*(?<type>[^|\n]+?)\s*\|\s*(?<defaultValue>[^|\n]+?)?\s*\|\s*(?<description>[^|\n]+?)\s*?\|?$/gm
const VALUES_TITLE_REGEX = /Value\s+?\| Description\n-+\|-+\n/gm
const VALUE_CAPTURE_REGEX = /^(?<value>[^|]+?)\s*\|\s*(?<description>[^|\n]+?)$/gm
const EXAMPLES_REGEX = /###\s*?Examples?\s*([^]+)/
const NOTE_REGEX = /^!!! (?<type>.+)\n\n(?<content>.+)$/gm

const MDFILE_CACHE_PATH = './.mdFileCache.json'

export function parseMDLink(url: string): { name: string; target: string } | undefined {
	MD_LINK_REGEX.lastIndex = 0
	const match = MD_LINK_REGEX.exec(url)
	if (!match) return
	return match.groups as { name: string; target: string }
}

export function pathToUrl(from: string, path: string) {
	const url = new URL(path, from)
	return url.href
}

let mdFileCache: Record<string, string> | undefined

async function fetchMDFileCached(url: string): Promise<string> {
	if (!mdFileCache) {
		if (fs.existsSync(MDFILE_CACHE_PATH)) {
			mdFileCache = JSON.parse(await fs.promises.readFile(MDFILE_CACHE_PATH, 'utf-8'))
		} else {
			mdFileCache = {}
		}
	}

	if (mdFileCache![url]) return mdFileCache![url]

	const content = await fetch(url).then(res => res.text())
	if (!content || content.includes('404: Not Found'))
		throw new Error(`Failed to fetch content of '${url}': ${content}`)

	mdFileCache![url] = content
	await fs.promises.writeFile(MDFILE_CACHE_PATH, JSON.stringify(mdFileCache))
	return content
}

function processDescription(description: string, mdFile: MDFile) {
	let link = MD_LINK_REGEX.exec(description)
	while (link) {
		// term.brightRed(link[0])('\n')
		const { name } = link.groups!
		// term.brightGreen(`[${name}](${mdFile.docsUrl})`)('\n')
		description = description.replace(link[0], `[${name}](${mdFile.docsUrl})`)
		link = MD_LINK_REGEX.exec(description)
	}

	let note = NOTE_REGEX.exec(description)
	while (note) {
		const { type, content } = note.groups!
		let title = '📝 Note'
		switch (type) {
			case 'caution':
				title = '⚠️ Caution'
				break
			case 'danger':
				title = '💀 Danger'
				break
		}
		description = description.replace(note[0], `\n\n---\n\n### ${title}\n\n${content.trim()}\n\n`)
		note = NOTE_REGEX.exec(description)
	}

	description = description
		.replace(/(?<=[^\w_])_(.+?)_(?=[^\w_])/g, '*$1*')
		.replace(/\*\*(.+?)\*\*/g, '__$1__')

	return description
}

export class Field {
	public optional: boolean = false
	public name: string
	public type: string = ''
	public typePath: string = ''
	public defaultValue: undefined | string = undefined
	public depreciated: boolean = false
	public mdFile: MDFile
	public subTypes: Array<{ name: string; target: string }> = []

	constructor(
		name: string,
		type: string,
		defaultValue: string,
		public description: string,
		mdFile: MDFile,
	) {
		this.mdFile = mdFile
		this.name = name.replaceAll('`', '')
		this.description = description.trim()
		this.parseType(type)
		this.parseDefaultValue(defaultValue)
		this.description = processDescription(description, mdFile)
	}

	private parseType(type: string) {
		const url = parseMDLink(type)
		if (!url) {
			TERM.brightRed('Failed to parse type ')(`'${type}'`)
				.brightRed(' for field ')(`'${this.name}'`)
				.brightRed(' of ')(`'${this.mdFile.id}'`)('\n')
			this.type = type.trim().replaceAll(/(?:^["[]|["\]]$)/g, '')
			return
		}
		this.type = url.name.trim().replaceAll(/(?:^"|"$)/g, '')
		if (url.name.toLowerCase() === 'array') {
			for (const subType of type.matchAll(MD_LINK_REGEX)) {
				const subTypeUrl = parseMDLink(subType[0])
				if (!subTypeUrl)
					throw new Error(`Failed to parse sub type '${subType[0]}' for Array field '${this.name}'`)
				this.subTypes.push({ name: subTypeUrl.name, target: subTypeUrl.target })
			}
		}
		this.typePath = url.target
	}

	private parseDefaultValue(defaultValue: string) {
		if (!defaultValue) return
		this.depreciated = !!defaultValue?.toLowerCase().includes('deprecated')
		if (defaultValue.toLowerCase().includes(`optional`)) {
			this.optional = true
			return
		}
		this.defaultValue = defaultValue
			.replaceAll('`', '')
			.trim()
			.replaceAll(/(?:^"|"$)/g, '')
			.trim()
	}
}

export class MDFile {
	public content: string = ''
	public id: string = ''
	public title: string = ''
	public description: string = ''
	public examples: string = ''
	public fields: Field[] = []
	public values: Array<{ value: string; description: string }> = []
	public url: string
	private _docsUrl: string = ''
	private _rawUrl: string = ''

	constructor(
		public path: string,
		docsUrl?: string,
		rawUrl?: string,
	) {
		this._rawUrl = rawUrl || pathToUrl(MODULES.origins.rawUrl, path)
		this.url = pathToUrl(this._rawUrl, path)
		this._docsUrl = docsUrl || pathToUrl(MODULES.origins.docsUrl, path)
	}

	public static fromRawURL(url: string) {
		for (const module of Object.values(MODULES)) {
			if (url.startsWith(module.rawUrl)) {
				const path = url.replace(module.rawUrl, '')
				return new MDFile(path, module.docsUrl, module.rawUrl)
			}
		}
		throw new Error(`Failed to parse raw url '${url}'`)
	}

	public static fromDocsURL(url: string) {
		let docsUrl = ''
		let rawUrl = ''

		for (const module of Object.values(MODULES)) {
			if (url.startsWith(module.docsUrl)) {
				docsUrl = module.docsUrl
				rawUrl = module.rawUrl
				break
			}
		}
		if (!docsUrl || !rawUrl) throw new Error(`Failed to parse docs url '${url}'`)
		let path = url.replace(docsUrl, '')

		if (path.endsWith('/')) path = path.slice(0, -1) + '.md'
		return new MDFile(path, docsUrl, rawUrl)
	}

	public static fromFile(path: string) {
		// TERM.gray(`Reading Markdown File `).brightBlue(path).gray('...\n')

		const file = new MDFile(path.replace(/\\/g, '/'))

		file.content = fs.readFileSync(path, 'utf-8')
		if (!file.content || file.content.includes('404: Not Found'))
			throw new Error(`Failed to read content of '${file.path}':\n  ${file.content}`)
		file.content = file.content.replace(/\r/g, '')

		try {
			file.id = file.path.split('/').pop()!.replace('.md', '')
			file.captureDescription()
			file.captureFields()
			file.captureValues()
			file.captureExamples()
		} catch (e: any) {
			throw new Error(`Failed to parse content of '${file.path}':\n  ${e.message}`)
		}

		return file
	}

	public async fetchContent(): Promise<MDFile> {
		const url = this._rawUrl + this.path
		// term.gray(`Reading Markdown File `).brightBlue(url).gray('...\n')

		this.content = (await fetchMDFileCached(url)).replace(/\r/g, '')
		try {
			this.id = this.path.split('/').pop()!.replace('.md', '')
			this.captureDescription()
			this.captureFields()
			this.captureValues()
			this.captureExamples()
		} catch (e: any) {
			throw new Error(`Failed to parse content of '${this.path}':\n  ${e.message}`)
		}

		return this
	}

	public getField(name: string) {
		const field = this.fields.find(field => field.name === name)
		// if (!field) throw new Error(`No field called '${name}' in '${this.id}' (${this.path})`)
		return field
	}

	private captureDescription() {
		DESCRIPTION_REGEX.lastIndex = 0
		const match = DESCRIPTION_REGEX.exec(this.content)
		if (!match) {
			TERM.brightRed(`No description found for `)(this.path).brightRed(
				'. Attempting to capture loose description...\n',
			)
			LOOSE_DESCRIPTION_REGEX.lastIndex = 0
			const looseMatch = LOOSE_DESCRIPTION_REGEX.exec(this.content)
			if (!looseMatch) {
				throw new Error(`Failed to capture description for '${this.path}': \n  ${this.content}`)
			}
			this.title = pathjs
				.parse(this.path)
				.name.replace(/[-_]+/g, ' ')
				.replace(/\.\w+?$/, '')
			this.description = processDescription(looseMatch[0], this)
			return
		}
		const { title, description } = match.groups!
		this.title = title
		this.description = processDescription(description, this)
	}

	private captureExamples() {
		DESCRIPTION_REGEX.lastIndex = 0
		const match = EXAMPLES_REGEX.exec(this.content)
		if (!match) {
			// term.gray(`No examples found for `).cyan(this.path)('\n')
			return
		}
		this.examples = processDescription(match[0], this)
	}

	private captureFields() {
		FIELD_TITLE_REGEX.lastIndex = 0
		const locations = this.content.split(FIELD_TITLE_REGEX)
		if (locations.length < 2) {
			// term.gray(`No fields found for `).cyan(this.path)('\n')
			return
		}
		for (const location of locations) {
			FIELD_CAPTURE_REGEX.lastIndex = 0
			while (!location.startsWith('\n')) {
				const fieldMatch = FIELD_CAPTURE_REGEX.exec(location)
				if (!fieldMatch) break
				const { field, type, defaultValue, description } = fieldMatch.groups!
				this.fields.push(
					new Field(field, type, defaultValue, processDescription(description, this), this),
				)
			}
		}
		if (!this.fields.length)
			throw new Error(`Failed to capture fields for '${this.path}': \n  ${this.content}`)
	}

	private captureValues() {
		VALUES_TITLE_REGEX.lastIndex = 0
		const match = this.content.split(VALUES_TITLE_REGEX).pop()
		if (match === this.content) {
			// term.gray(`No values found for `).cyan(this.path)('\n')
			return
		}
		VALUE_CAPTURE_REGEX.lastIndex = 0
		while (!match!.startsWith('\n')) {
			const valueMatch = VALUE_CAPTURE_REGEX.exec(match!)
			if (!valueMatch) break
			const { value, description } = valueMatch.groups!
			this.values.push({ value, description: processDescription(description, this) })
		}
		if (!this.values.length)
			throw new Error(`Failed to capture values for '${this.path}': \n  ${this.content}`)
	}

	get docsUrl() {
		return this._docsUrl + this.path.replace('.md', '')
	}
}
