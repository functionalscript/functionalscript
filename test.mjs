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

/** @typedef {{ exports?: unknown }} Module */

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
                    if (!['node_modules', 'target'].includes(name)) {
                        await f(file)
                    }
                } else if (name.endsWith('.f.cjs')) {
                    console.log(`loading ${file}`)
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

const test = i => v => {
    switch (typeof v) {
        case 'function': {
            if (v.length === 0) {
                const r = v()
                console.log(`${i}() passed`)
                test(`${i}| `)(r)
            }
            return;
        }
        case 'object': {
            if (v instanceof Array) {
                for (const v2 of v) {
                    test(`${i}| `)(v2)
                }
            } else {
                for (const [k, v2] of Object.entries(v)) {
                    const i2 = `${i}| `
                    console.log(`${i}${k}:`)
                    test(i2)(v2)
                }
            }
            return;
        }
    }
}

for (const [k, v] of Object.entries(modules)) {
    if (k.endsWith('test.f.cjs')) {
        console.log(`testing ${k}`)
        test('| ')(v)
    }
}