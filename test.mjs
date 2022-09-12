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
const fs = await import(globalThis.Deno ? 'https://deno.land/std/node/fs/promises.ts' : 'node:fs/promises')

const load = async() => {
    /** @type {FunctionMap} */
    const map = {}
    /** @type {(path: string) => Promise<void>} */
    const f = async p => {
        for (const i of await fs.readdir(p, { withFileTypes: true })) {
            const { name } = i
            if (!name.startsWith('.')) {
                const file = `${p}/${name}`
                if (i.isDirectory()) {
                    if (!['node_modules', 'target'].includes(name)) {
                        await f(file)
                    }
                } else if (name.endsWith('.f.cjs')) {
                    console.log(`loading ${file}`)
                    const source = await fs.readFile(file, 'utf8')
                    map[file] = Function('module', 'require', `"use strict";${source}`)
                }
            }
        }
    }
    await f('.')
    return map
}

const map = await load()

/** @typedef {{ exports?: unknown }} Module */

/** @typedef {(name: string) => unknown} Require */

/**
 * @typedef {{
 *  [k in string]: Function
 * }} FunctionMap
 */

/**
 * @typedef {{
 *  [k in string]: unknown
 * }} ModuleMap
 */

const build = async () => {
    /** @type {ModuleMap} */
    const d = {}
    /** @type {(base: readonly string[]) => (i: string) => (k: string) => unknown} */
    const req = p => i => k => {
        const relativePath = k.split('/')
        const dif = relativePath.filter(v => v === '..').length
        const path = [p.slice(0, p.length - dif), relativePath.filter(v => !['..', '.'].includes(v))]
            .flat()
        const pathStr = path.join('/')
        const newBase = path.slice(0, path.length - 1)
        const result = d[pathStr]
        if (result === undefined) {
            /** @type {Module} */
            const me = {}
            console.log(`${i}building ${pathStr}`)
            map[pathStr](me, req(newBase)(`${i}| `))
            const newResult = me.exports
            d[pathStr] = newResult
            return newResult
        } else {
            return result
        }
    }
    const r = req(['.'])('')
    for (const k of Object.keys(map)) {
        r(k)
    }
    return d
}

const modules = await build()
