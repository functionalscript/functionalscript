import { readdir, readFile, writeFile } from 'node:fs/promises'

/**
 * @typedef {{
 *  readonly withFileTypes: true
 * }} Options
 */

/**
 * @typedef {{
 *  readonly name: string
 *  readonly isDirectory: () => boolean
 * }} Dirent
 */

/**
 * @typedef {{
 *  readonly readdir: (path: string, options: Options) => Promise<readonly Dirent[]>
 *  readonly readFile: (path: string, options: 'utf8') => Promise<string>
 * }} FsPromises
 */

/**
 * @typedef {{
 *  exports?: unknown
 * }} MutableModule
 */

/**
 * @typedef {{
 *  readonly exports?: unknown
 * }} Module
 */

/** @typedef {(name: string) => unknown} Require */

/**
 * @typedef {{
 *  readonly[k in string]: unknown
 * }} UnknownMap
 */

/**
 * @template T
 * @typedef {readonly[string, T]} Entry
 */

/** @type {(a: Entry<unknown>, b: Entry<unknown>) => number} */
const cmp = ([a], [b]) => a < b ? -1 : a > b ? 1 : 0

/**
 * @typedef {{
 *  [k in string]: MutableModule
 * }} MutableModuleMap
 */

/**
 * @typedef {{
 *  readonly[k in string]: Module
 * }} ModuleMap
 */

/** @type {(v: readonly string[]) => (dif: number) => readonly string[]} */
const remove_tail = v => dif => v.slice(0, v.length - dif)

/** @type {any} */
const self = globalThis

/** @type {(code: number) => never} */
export const exit = self.Deno ? self.Deno.exit : process.exit

/** @type {(v: string) => string|undefined} */
export const env =
    self.Deno ? self.Deno.env.get :
    a => {
        const r = Object.getOwnPropertyDescriptor(process.env, a)
        return r === void 0 ? void 0 :
            typeof r.get === 'function' ? r.get() :
            r.value
    }

export const loadModuleMap = async () => {
    /** @type {() => Promise<UnknownMap>} */
    const load = async () => {
        /** @type {(readonly[string, unknown])[]} */
        const map = []
        /** @type {(path: string) => Promise<void>} */
        const f = async p => {
            for (const i of await readdir(p, { withFileTypes: true })) {
                const { name } = i
                if (!name.startsWith('.')) {
                    const file = `${p}/${name}`
                    if (i.isDirectory()) {
                        await f(file)
                    } else if (name.endsWith('.f.cjs')) {
                        const source = await import(`../${file}`)
                        map.push([file, source.default])
                    }
                }
            }
        }
        await f('.')
        map.sort(cmp)
        return Object.fromEntries(map)
    }

    const map = await load()

    /** @type {() => ModuleMap} */
    const build = () => {
        /** @type {MutableModuleMap} */
        const d = {}
        /** @type {(base: readonly string[]) => (k: string) => readonly[string, MutableModule]} */
        const getModule = base => k => {
            const relativePath = k.split('/')
            const dif = relativePath.filter(v => v === '..').length
            const path = [remove_tail(base)(dif), relativePath.filter(v => !['..', '.'].includes(v))]
                .flat()
            const pathStr = path.join('/')
            {
                const module = d[pathStr]
                if (module !== void 0) {
                    return [pathStr, module]
                }
            }
            {
                /** @type {MutableModule} */
                const module = { exports: map[pathStr] }
                d[pathStr] = module
                return [pathStr, module]
            }
        }
        {
            const get = getModule(['.'])
            for (const k of Object.keys(map)) {
                get(k)
            }
        }
        return d
    }

    return build()
}

/**
 * @typedef {{
 *  readonly[k in string]: string | FolderMap
 * }} FolderMap
 */

/** @type {(m: FolderMap) => (s: readonly string[]) => FolderMap } */
const folderMapAdd = m => s => {
    const [first, ...rest] = s
    const firstResult = m[first]
    return typeof firstResult === 'string'
        ? m
        : {
            ...m,
            [first]: rest.length === 1
                ? rest[0]
                : folderMapAdd(firstResult === undefined ? {} : firstResult)(rest)
        }
}

const indent = '  '

/** @type {(i: string) => (p: string) => (m: FolderMap) => string} */
const codeAdd = i => p => m => {
    let result = ''
    for (const [k, v] of Object.entries(m)) {
        const np = `${p}${k}/`
        if (typeof v === 'string') {
            result += `${i}${k}: require("${np}${v}"),\n`
        } else {
            result += `${i}${k}: \{\n`
            result += codeAdd(i + indent)(np)(v)
            result += `${i}\},\n`
        }
    }
    return result
}

export const index = async() => {
    /** @type {FolderMap} */
    let m = {}
    for (const k in await loadModuleMap()) {
        const [, ...s] = k.split('/')
        if (s[s.length - 1] === 'module.f.cjs') {
            m = folderMapAdd(m)(s)
        }
    }
    console.log(m)
    let s =
        '// Generated file.\n' +
        'module.exports = {\n'
    s += codeAdd(indent)('./')(m)
    s += '}\n'
    await writeFile('index.f.cjs', s)
}
