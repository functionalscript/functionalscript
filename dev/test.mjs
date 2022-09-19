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
 *  readonly readFile: (path: string, options: 'utf8') => Promise<Buffer>
 * }} FsPromises
 */

/** @type {FsPromises} */
const { readdir, readFile } = await import(globalThis.Deno ? 'https://deno.land/std/node/fs/promises.ts' : 'node:fs/promises')

/**
 * @typedef {{
 *  [k in string]?: Module
 * }} DependencyMap
 */

/**
 * @typedef {{
 *  dependencyMap: DependencyMap
 *  exports?: unknown
 * }} Module
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

/**
 * @typedef {{
 *  [k in string]: Module
 * }} ModuleMap
 */

const build = async () => {
    /** @type {ModuleMap} */
    const d = {}
    /** @type {(base: readonly string[]) => (k: string) => readonly[string, Module]} */
    const req = base => k => {
        const relativePath = k.split('/')
        const dif = relativePath.filter(v => v === '..').length
        const path = [base.slice(0, base.length - dif), relativePath.filter(v => !['..', '.'].includes(v))]
            .flat()
        const pathStr = path.join('/')
        const newBase = path.slice(0, path.length - 1)
        {
            const module = d[pathStr]
            if (module !== undefined) {
                return [pathStr, module]
            }
        }
        {
            /** @type {Module} */
            const module = {
                dependencyMap: {}
            }
            const getModule = req(newBase)
            const newReq = s => {
                const [p, result] = getModule(s)
                module.dependencyMap[p] = result
                return result.exports
            }
            map[pathStr](module, newReq)
            d[pathStr] = module
            return [pathStr, module]
        }
    }
    const r = req(['.'])
    for (const k of Object.keys(map)) {
        r(k)
    }
    return d
}

const moduleMap = await build()

// test runner.

moduleMap['./dev/test/module.f.cjs'].exports({
    moduleMap,
    log: console.log,
})
