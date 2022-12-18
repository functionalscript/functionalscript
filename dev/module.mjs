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
 *  [k in string]?: MutableModule
 * }} MutableDependencyMap
 */

/**
 * @typedef {{
 *  dependencyMap: MutableDependencyMap
 *  exports?: unknown
 * }} MutableModule
 */

/**
 * @typedef {{
 *  readonly dependencyMap: DependencyMap
 *  readonly exports?: unknown
 * }} Module
 */

/**
 * @typedef {{
 *   readonly[k in string]?: Module
 * }} DependencyMap
 */

/** @typedef {(name: string) => unknown} Require */

/**
 * @typedef {{
 *  readonly[k in string]: Function
 * }} FunctionMap
 */

/**
 * @template T
 * @typedef {readonly[string, T]} Entry
 */

/** @type {(a: Entry<Function>, b: Entry<Function>) => number} */
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

/** @type {() => Promise<FsPromises>} */
export const fs = () => import(self.Deno ? 'https://deno.land/std/node/fs/promises.ts' : 'node:fs/promises')

/** @type {(code: number) => never} */
export const exit = self.Deno ? self.Deno.exit : process.exit

/** @type {(v: string) => string|undefined} */
export const env = self.Deno ? self.Deno.env.get : a => Object.getOwnPropertyDescriptor(process.env, a)?.value

export const loadModuleMap = async () => {
    const { readdir, readFile } = await fs();

    /** @type {() => Promise<FunctionMap>} */
    const load = async () => {
        /** @type {(readonly[string, Function])[]} */
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
                        const source = await readFile(file, 'utf8')
                        map.push([file, Function('module', 'require', `"use strict";${source}`)])
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
                /** @type {MutableDependencyMap} */
                const dependencyMap = {}
                /** @type {MutableModule} */
                const module = { dependencyMap }
                const get = getModule(remove_tail(path)(1))
                /** @type {(s: string) => unknown} */
                const newReq = s => {
                    const [p, result] = get(s)
                    dependencyMap[p] = result
                    return result.exports
                }
                map[pathStr](module, newReq)
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