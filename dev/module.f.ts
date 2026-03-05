/**
 * Development utilities for indexing modules and loading FunctionalScript files.
 *
 * @module
 */
import { fromIo, type Io } from '../io/module.f.ts'
import type { Sign } from '../types/function/compare/module.f.ts'
import { updateVersion } from './version/module.f.ts'
import { encodeUtf8 } from '../types/uint8array/module.f.ts'
import { all, readdir, readFile, writeFile, type All, type Readdir, type ReadFile } from '../types/effects/node/module.f.ts'
import { utf8, utf8ToString } from '../text/module.f.ts'
import { unwrap } from '../types/result/module.f.ts'
import { fluent, pure, type Do, type Effect } from '../types/effects/module.f.ts'

export const todo = (): never => { throw 'not implemented' }

export type Module = {
    readonly default?: unknown
}

type Entry<T> = readonly[string, T]

const cmp = ([a]: Entry<unknown>, [b]: Entry<unknown>): Sign =>
    a < b ? -1 : a > b ? 1 : 0

export type ModuleMap = {
   readonly[k in string]: Module
}

export const env
    : (io: Io) => (v: string) => string|undefined
    = ({ process: { env } }) => a => {
        const r = Object.getOwnPropertyDescriptor(env, a)
        return r === undefined ? undefined :
            typeof r.get === 'function' ? r.get() :
                r.value
    }

type ModuleArray = readonly (readonly[string, Module])[]

export const allFiles2 = (s: string): Effect<Readdir & All, readonly string[]> => {
    const load = (p: string): Effect<Readdir & All, readonly string[]> => fluent
        .step(() => readdir(p, {}))
        .step(d => {
            let result: readonly Effect<Readdir & All, readonly string[]>[] = []
            for (const i of unwrap(d)) {
                const { name } = i
                if (name.startsWith('.')) { continue }
                const file = `${p}/${name}`
                if (!i.isFile) {
                    if (name === 'node_modules') { continue }
                    result = [...result, load(file)]
                    continue
                }
                if (name.endsWith('.js') || name.endsWith('.ts')) {
                    result = [...result, pure([file])]
                }
            }
            return all(...result)
        })
        .step(v => pure(v.flat()))
        .effect
    return load(s)
}

export const allFiles = (io: Io) => (s: string): Promise<readonly string[]> => {
    const { fs: { promises: { readdir }} } = io
    const load = async(p: string): Promise<readonly string[]> => {
        let result: readonly string[] = []
        for (const i of await readdir(p, { withFileTypes: true })) {
            const { name } = i
            if (name.startsWith('.')) { continue }
            const file = `${p}/${name}`
            if (i.isDirectory()) {
                if (name === 'node_modules') { continue }
                result = [...result, ...await load(file)]
                continue
            }
            if (name.endsWith('.js') || name.endsWith('.ts')) {
                result = [...result, file]
            }
        }
        return result
    }
    return load(s)
}

export const loadModuleMap = async (io: Io): Promise<ModuleMap> => {
    const {
        fs: { existsSync },
        asyncImport
    } = io
    let map: ModuleArray = []
    const initCwd = env(io)('INIT_CWD')
    const s = initCwd === undefined ? '.' : `${initCwd.replaceAll('\\', '/')}`
    for (const f of await allFiles(io)(s)) {
        if (f.endsWith('.f.js') ||
            (f.endsWith('.f.ts') && !existsSync(f.substring(0, f.length - 3) + '.js'))
        ) {
            const source = await asyncImport(f)
            map = [...map, [f, source]]
        }
    }
    return Object.fromEntries(map.toSorted(cmp))
}

const denoJson = './deno.json'

const index2: Effect<ReadFile, unknown> = fluent
    .step(() => updateVersion)
    .step(() => readFile(denoJson))
    .step(v => pure(JSON.parse(utf8ToString(unwrap(v)))))
    .effect

const allFiles2a = (jsr_json: unknown) => fluent
    .step(() => allFiles2('.'))
    .step(files => {
        // console.log(files)
        const list = files.filter(v => v.endsWith('/module.f.ts') || v.endsWith('/module.ts'))
        const exportsA = list.map(v => [v, `./${v.substring(2)}`])
        const exports = Object.fromEntries(exportsA)
        const json = JSON.stringify({ ...jsr_json as any, exports }, null, 2)
        return writeFile(denoJson, utf8(json))
    })
    .step(() => pure(0))
    .effect

export const index = async (io: Io): Promise<number> => {
    const runner = fromIo(io)
    const jsr_json = await runner(index2)
    return await runner(allFiles2a(jsr_json))
}
