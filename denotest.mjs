// import * as fs from "https://deno.land/std/node/fs.ts"

/**
 * @type {{
 *  readonly readDir: (path: string | URL) => AsyncIterable<DirEntry>,
 *  readonly readTextFile: (path: string | URL) => Promise<string>,
 * }}
 */
const {
    readDir,
    readTextFile,
} = Deno

/**
 * @typedef {{
 *  readonly isDirectory: boolean
 *  readonly isFile: boolean
 *  readonly isSymlink: boolean
 *  readonly name: string
 * }} DirEntry
 */

/** @typedef {{ exports?: unknown }} Module */

/** @typedef {(name: string) => unknown} Require */

/**
 * @typedef {{
 *  [k in string]: Function
 * }} FunctionMap
 */

/** @type {(path: string) => Promise<FunctionMap>} */
const dir = async p => {
    /** @type {FunctionMap} */
    const map = {}
    /** @type {(path: string) => Promise<void>} */
    const f = async p => {
        for await (const i of readDir(p)) {
            const { name } = i
            if (!name.startsWith('.')) {
                const file = `${p}/${name}`
                if (i.isDirectory) {
                    if (!['node_modules', 'target'].includes(name)) {
                        await f(file)
                    }
                } else if (name.endsWith('.f.cjs')) {
                    console.log(`loading ${file}`)
                    const source = await readTextFile(file)
                    map[file] = Function('module', 'require', `"use strict";${source}`)
                }
            }
        }
    }
    await f(p)
    return map
}

/**
 * @typedef {{
 *  [k in string]: unknown
 * }} ModuleMap
 */

const run = async () => {
    const m = await dir('.')
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
            m[pathStr](me, req(newBase)(`${i}| `))
            const newResult = me.exports
            d[pathStr] = newResult
            return newResult
        } else {
            return result
        }
    }
    const r = req(['.'])('')
    for (const k of Object.keys(m)) {
        r(k)
    }
}

run()
