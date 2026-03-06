/**
 * Development utilities for indexing modules and loading FunctionalScript files.
 *
 * @module
 */
import { fromIo, type Io } from '../io/module.f.ts'
import type { Sign } from '../types/function/compare/module.f.ts'
import { updateVersion } from './version/module.f.ts'
import { all, both, readdir, readFile, writeFile, type All, type NodeProgram, type Readdir } from '../types/effects/node/module.f.ts'
import { utf8, utf8ToString } from '../text/module.f.ts'
import { unwrap } from '../types/result/module.f.ts'
import { begin, pure, type Effect } from '../types/effects/module.f.ts'

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

export const allFiles2 = (s: string): Effect<Readdir | All, readonly string[]> => {
    const load = (p: string): Effect<Readdir | All, readonly string[]> => begin
        .step(() => readdir(p, {}))
        .step(d => {
            let result: readonly Effect<Readdir | All, readonly string[]>[] = []
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
    return load(s)
}

/*
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
*/

export const allFiles = (io: Io) => (s: string): Promise<readonly string[]> =>
    fromIo(io)(allFiles2(s))

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

const index2 = begin
    .step(() => updateVersion)
    .step(() => readFile(denoJson))
    .step(v => pure(JSON.parse(utf8ToString(unwrap(v))) as unknown))

const allFiles2aa = begin
    .step(() => allFiles2('.'))
    .step(files => {
        const list = files.filter(v => v.endsWith('/module.f.ts') || v.endsWith('/module.ts'))
        const exportsA = list.map(v => [v, `./${v.substring(2)}`] as const)
        return pure(Object.fromEntries(exportsA))
    })

const index3 = both(index2)(allFiles2aa)
    .step(([jsr_json, exports]) => {
        const json = JSON.stringify({ ...jsr_json as object, exports }, null, 2)
        return writeFile(denoJson, utf8(json))
    })
    .step(() => pure(0))

export const index4: NodeProgram = () => index3
