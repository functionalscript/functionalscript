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

/**
 * @typedef {{
 *  [k in string]: Module
 * }} ModuleMap
 */

/** @type {(v: readonly string[]) => (dif: number) => readonly string[]} */
const remove_tail = v => dif =>
    v.slice(0, v.length - dif)

const boot = async() => {
    /** @type {any} */
    const self = globalThis

    /** @type {FsPromises} */
    const { readdir, readFile } = await import(self.Deno ? 'https://deno.land/std/node/fs/promises.ts' : 'node:fs/promises')

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

    const build = async () => {
        /** @type {ModuleMap} */
        const d = {}
        /** @type {(base: readonly string[]) => (k: string) => readonly[string, Module]} */
        const req = base => k => {
            const relativePath = k.split('/')
            const dif = relativePath.filter(v => v === '..').length
            const path = [remove_tail(base)(dif), relativePath.filter(v => !['..', '.'].includes(v))]
                .flat()
            const pathStr = path.join('/')
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
                const getModule = req(remove_tail(path)(1))
                /** @type {(s: string) => unknown} */
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

    return await build()
}

// test runner.
const main = async() => {
    const moduleMap = await boot()

    /** @type {(s: string) => (_: undefined) => undefined} */
    const log = s => state => {
        console.log(s)
        return state
    }

    /** @type {any} */
    const f = moduleMap['./dev/test/module.f.cjs'].exports
    f({
        moduleMap,
        log,
    })
}

main()