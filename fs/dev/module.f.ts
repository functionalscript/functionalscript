/**
 * Development utilities for indexing modules and loading FunctionalScript files.
 *
 * @module
 */
import {
    all,
    import_,
    readdir,
    type Access,
    type All,
    type Env,
    type Import,
    type Readdir
} from '../effects/node/module.f.ts'
import { cmp as strCmp } from '../types/string/module.f.ts'
import { unwrap } from '../types/result/module.f.ts'
import { pure, type Effect } from '../effects/module.f.ts'
import { relativize, toPosix } from '../path/module.f.ts'

export type Module = {
    readonly proof?: unknown
    readonly [k: string]: unknown
}

export type ModuleMap = {
   readonly[k in string]: Module
}

/**
 * Returns `true` if the file should be loaded for proof discovery.
 *
 * All FunctionalScript modules (`.f.ts` / `.f.js`) are safe to bulk-load by
 * construction — they have no import side effects. For vanilla TS/JS the
 * load gate stays opt-in by filename: any file ending in `proof.ts`,
 * `proof.js`, `proof.mts`, or `proof.mjs` is included.
 *
 * Whether a loaded module actually _contains_ a proof is determined at
 * runtime by checking for an exported `proof` property.
 */
export const shouldLoad = (s: string): boolean =>
    s.endsWith('.f.ts')    || s.endsWith('.f.js')    ||
    s.endsWith('proof.ts') || s.endsWith('proof.js') ||
    s.endsWith('proof.mts')|| s.endsWith('proof.mjs')

const isSourceFile = (path: string): boolean =>
    path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.mts') || path.endsWith('.mjs')

const allFiles = (
    s: string,
    predicate: (path: string) => boolean,
): Effect<Readdir | All, readonly string[]> => {
    const load = (p: string): Effect<Readdir | All, readonly string[]> => readdir(p, {})
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
                if (predicate(file)) {
                    result = [...result, pure([file])]
                }
            }
            return all(...result)
        })
        .step(v => pure(v.flat()))
    return load(s)
}

const loadFile = (f: string): Effect<Access | Import, readonly (readonly[string, Module])[]> =>
    import_(f).step(r => pure([[f, unwrap(r)] as const]))

/** The effect operations required to discover and load a module map. */
export type LoadModuleOperations = Access | Import | All | Readdir

const { fromEntries } = Object

/**
 * Discovers all source files under `INIT_CWD` (or `.` if unset) that match
 * `predicate`, imports them, and returns a map from relative path to module
 * exports.
 *
 * The `predicate` is propagated into `allFiles` so that non-matching files
 * are excluded before any `import()` is attempted — no wasted I/O.
 * The default matches all JS/TS source files (`.js`, `.ts`, `.mts`, `.mjs`).
 * `loadFile`'s own guards (`.f.js`, `.f.ts`, `shouldLoad`) still apply on
 * top; the predicate only controls which files are discovered.
 *
 * The result is sorted by path key using `string.cmp` so the order is
 * deterministic regardless of filesystem traversal order.
 */
export const loadModuleMap = (env: Env): Effect<LoadModuleOperations, ModuleMap> => {
    const initCwd = env['INIT_CWD']
    const s = initCwd === undefined ? '.' : toPosix(initCwd)
    const prefix = s === '.' ? '' : s
    // TODO: there are multiple `all` effects here,
    //       we should consider optimize them by ALIQ technique or something similar.
    //       For example, we should be able to write it like `allFiles(s).flatMap(loadFile)`,
    //       then an effect runner can batch all file loading operations together.
    return allFiles(s, shouldLoad)
    .step(files => all(...files.map(loadFile)))
    .step(entries => pure(fromEntries(
        entries
            .flat()
            .map(([k, v]) => [relativize(prefix, k), v] as const)
            .toSorted(([a], [b]) => strCmp(a)(b))
    )))
}
