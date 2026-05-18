/**
 * Development utilities for indexing modules and loading FunctionalScript files.
 *
 * @module
 */
import { fromIo, type Io } from '../io/module.f.ts'
import type { Sign } from '../types/function/compare/module.f.ts'
import { updateVersion } from './version/module.f.ts'
import {
    access,
    all,
    both,
    import_,
    readdir,
    readFile,
    writeFile,
    type All,
    type NodeOp,
    type NodeProgram,
    type Readdir
} from '../types/effects/node/module.f.ts'
import { utf8, utf8ToString } from '../text/module.f.ts'
import { unwrap } from '../types/result/module.f.ts'
import { begin, pure, type Effect } from '../types/effects/module.f.ts'

export const todo = (): never => { throw 'not implemented' }

export const assert: (v: boolean, msg?: unknown) => asserts v = (v, msg = 'assertion failed') => {
    if (!v) throw msg
}

export const assertEq = <T>(a: T, b: T): void =>
    assert(a === b, [a, b])

export type Module = {
    readonly default?: unknown
    readonly [k: string]: unknown
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

export const allFiles = (s: string): Effect<Readdir | All, readonly string[]> => {
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

const loadFile = (f: string): Effect<NodeOp, readonly[string, Module] | undefined> => {
    const doImport = import_(f).step(r => pure([f, unwrap(r) as Module] as const))
    if (f.endsWith('.f.js')) { return doImport }
    if (f.endsWith('.f.ts')) {
        return access(f.substring(0, f.length - 3) + '.js')
            .step(r => r[0] === 'ok' ? pure(undefined) : doImport)
    }
    return pure(undefined)
}

export const loadModuleMap = async (io: Io): Promise<ModuleMap> => {
    const { process: { env } } = io
    const initCwd = env['INIT_CWD']
    const s = initCwd === undefined ? '.' : `${initCwd.replaceAll('\\', '/')}`
    const effect = allFiles(s)
        .step(files => all(...files.map(loadFile)))
        .step(entries => pure(
            Object.fromEntries(
                entries
                    .flatMap(e => e !== undefined ? [e] : [])
                    .toSorted(cmp)
            )
        ))
    return fromIo(io)(effect)
}

const denoJson = './deno.json'

const index2 = begin
    .step(() => updateVersion)
    .step(() => readFile(denoJson))
    .step(v => pure(JSON.parse(utf8ToString(unwrap(v))) as unknown))

const allFiles2aa = begin
    .step(() => allFiles('.'))
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
