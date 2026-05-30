/**
 * Development utilities for indexing modules and loading FunctionalScript files.
 *
 * @module
 */
import type { Io } from '../io/module.f.ts'
import { updateVersion } from './version/module.f.ts'
import {
    access,
    all,
    both,
    import_,
    readdir,
    readFile,
    writeFile,
    type Access,
    type All,
    type Env,
    type Import,
    type NodeProgram,
    type Readdir
} from '../types/effects/node/module.f.ts'
import { cmp as strCmp } from '../types/string/module.f.ts'
import { utf8, utf8ToString } from '../text/module.f.ts'
import { unwrap } from '../types/result/module.f.ts'
import { begin, pure, type Effect } from '../types/effects/module.f.ts'
import { parse as jsonParse } from '../json/module.f.ts'
import { record, unknown as rttiUnknown } from '../types/rtti/module.f.ts'
import { parse as rttiParse } from '../types/rtti/parse/module.f.ts'
import { relativize } from '../path/module.f.ts'

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

/** Returns `true` if the file path looks like a FunctionalScript test module. */
export const isTest = (s: string): boolean =>
    s.endsWith('test.f.js') || s.endsWith('test.f.ts') ||
    s.endsWith('proof.f.ts') || s.endsWith('proof.f.js') ||
    s.endsWith('proof.ts')   || s.endsWith('proof.js')

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

const loadFile = (f: string): Effect<Access | Import, readonly (readonly[string, Module])[]> => {
    const doImport = import_(f).step(r => pure([[f, unwrap(r)] as const]))
    if (f.endsWith('.f.js')) { return doImport }
    if (f.endsWith('.f.ts')) {
        return access(f.substring(0, f.length - 3) + '.js')
            .step(r => r[0] === 'ok' ? pure([]) : doImport)
    }
    if (isTest(f)) { return doImport }
    return pure([])
}

/** The effect operations required to discover and load a module map. */
export type LoadModuleOperations = Access | Import | All | Readdir

const { fromEntries } = Object

/**
 * Discovers all `.f.js` / `.f.ts` modules under `INIT_CWD` (or `.` if unset)
 * and imports them, returning a map from relative path to module exports.
 *
 * The result is sorted by path key using `string.cmp` so the order is
 * deterministic regardless of filesystem traversal order.
 */
export const loadModuleMap = (env: Env): Effect<LoadModuleOperations, ModuleMap> => {
    const initCwd = env['INIT_CWD']
    const s = initCwd === undefined ? '.' : `${initCwd.replaceAll('\\', '/')}`
    const prefix = s === '.' ? '' : s
    // TODO: there are multiple `all` effects here,
    //       we should consider optimize them by ALIQ technique or something similar.
    //       For example, we should be able to write it like `allFiles(s).flatMap(loadFile)`,
    //       then an effect runner can batch all file loading operations together.
    return allFiles(s)
        .step(files => all(...files.map(loadFile)))
        .step(entries => pure(fromEntries(
            entries
                .flat()
                .map(([k, v]) => [relativize(prefix, k), v] as const)
                .toSorted(([a], [b]) => strCmp(a)(b))
        )))
}

const denoJson = './deno.json'

const parseDenoJson = rttiParse(record(rttiUnknown))

const index2 = begin
    .step(() => updateVersion)
    .step(() => readFile(denoJson))
    .step(v => pure(unwrap(parseDenoJson(jsonParse(utf8ToString(unwrap(v)))))))

const allFiles2aa = begin
    .step(() => allFiles('.'))
    .step(files => {
        const list = files.filter(v => v.endsWith('/module.f.ts') || v.endsWith('/module.ts'))
        const exportsA = list.map(v => [v, `./${v.substring(2)}`] as const)
        return pure(Object.fromEntries(exportsA))
    })

const index3 = both(index2)(allFiles2aa)
    .step(([jsr_json, exports]) => {
        const json = JSON.stringify({ ...jsr_json, exports }, null, 2)
        return writeFile(denoJson, utf8(json))
    })
    .step(() => pure(0))

export const index4: NodeProgram = () => index3
