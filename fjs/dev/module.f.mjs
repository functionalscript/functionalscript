/**
 * Development utilities for indexing modules and loading FunctionalScript files.
 *
 * @module
 *
 * @import { Access, All, Env, Import, IoChannel, Readdir } from '../effects/node/types.ts'
 * @import { Effect } from '../effects/types.ts'
 * @import { Dir } from '../effects/node/virtual/types.ts'
 * @import { Module, ModuleMap, LoadModuleOperations } from './types.ts'
 */

import { allOk, import_, readdir } from '../effects/node/module.f.mjs'
import { cmp as strCmp } from '../types/string/module.f.mjs'
import { fromEntries } from '../types/object/module.f.mjs'
import { unwrap } from '../types/result/module.f.mjs'
import { mapStep, pureOk, step } from '../effects/module.f.mjs'
import { join, relativize, toPosix } from '../path/module.f.mjs'
import { assert, assertEq } from '../asserts/module.f.mjs'
import { emptyState, virtual } from '../effects/node/virtual/module.f.mjs'

/**
 * Returns `true` if the file should be loaded for proof discovery.
 *
 * Two symmetrical rules, each covering all four TS/JS module extensions:
 *
 * - **FunctionalScript modules** — anything ending in `.f.ts`, `.f.mts`,
 *   `.f.js`, or `.f.mjs`. They are safe to bulk-load by construction, since
 *   they have no import side effects, so the whole module is loaded and its
 *   internal `proof` export (if any) is discovered. `.f.ts` and `.f.mjs` are
 *   the authored extensions; `.f.js` is generated from `.f.ts`.
 * - **Impure JavaScript/TypeScript proofs** — anything ending in `proof.ts`,
 *   `proof.mts`, `proof.js`, or `proof.mjs`. Outside FunctionalScript a module
 *   may have import side effects, so the load gate stays opt-in by filename.
 *
 * A `proof.f.mts` / `proof.f.mjs` matches the FunctionalScript rule by its
 * `.f.` infix, not the vanilla proof rule.
 *
 * Whether a loaded module actually _contains_ a proof is determined at
 * runtime by checking for an exported `proof` property.
 *
 * @type {(s: string) => boolean}
 */
export const shouldLoad = s =>
    s.endsWith('.f.ts')    || s.endsWith('.f.mts')   ||
    s.endsWith('.f.js')    || s.endsWith('.f.mjs')   ||
    s.endsWith('proof.ts') || s.endsWith('proof.mts')||
    s.endsWith('proof.js') || s.endsWith('proof.mjs')

/** @type {(path: string) => boolean} */
const isSourceFile = path =>
    path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.mts') || path.endsWith('.mjs')

/** @type {(s: string, predicate: (path: string) => boolean) => Effect<Readdir | All, readonly string[], IoChannel>} */
const allFiles = (s, predicate) => {
    /** @type {(p: string) => Effect<Readdir | All, readonly string[], IoChannel>} */
    const load = p => {
        const listed = step(
            readdir(p, {}),
            d => allOk(...d.flatMap(i => {
                const { name } = i
                if (name.startsWith('.')) { return [] }
                const file = join(p, name)
                return i.isFile
                    ? (predicate(file) ? [pureOk([file])] : [])
                    : (name === 'node_modules' ? [] : [load(file)])
            })))
        return mapStep(listed, v => v.flat())
    }
    return load(s)
}

/** @type {(f: string) => Effect<Access | Import, readonly (readonly [string, Module])[], IoChannel>} */
const loadFile = f =>
    mapStep(import_(f), m => [/** @type {const} */ ([f, m])])

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
 *
 * A failure — a directory that cannot be listed, a module that will not import
 * — propagates instead of panicking, so the program that asked for the map
 * decides what a partial view of the source tree means for it. Discovery reads
 * the whole tree, and a map missing the file it was asked about is worse than
 * no map at all.
 *
 * @type {(env: Env) => Effect<LoadModuleOperations, ModuleMap, IoChannel>}
 */
export const loadModuleMap = env => {
    const initCwd = env['INIT_CWD']
    const s = initCwd === undefined ? '.' : toPosix(initCwd)
    const prefix = s === '.' ? '' : s
    // TODO: there are multiple `all` effects here,
    //       we should consider optimizing them by ALIQ technique or something similar.
    //       For example, we should be able to write it like `allFiles(s).flatMap(loadFile)`,
    //       then an effect runner can batch all file loading operations together.
    const loaded = step(
        allFiles(s, shouldLoad),
        files => allOk(...files.map(loadFile)))
    return mapStep(
        loaded,
        entries => fromEntries(
            entries
                .flat()
                .map(([k, v]) => /** @type {const} */ ([relativize(prefix, k), v]))
                .toSorted(([a], [b]) => strCmp(a)(b))
        ))
}

export const proof = {
    isSourceFile: () => {
        assert(isSourceFile('module.js'))
        assert(isSourceFile('module.ts'))
        assert(isSourceFile('module.mts'))
        assert(isSourceFile('module.mjs'))
        assert(!isSourceFile('readme.md'))
        assert(!isSourceFile('module.json'))
    },
    allFilesFindsFunctionalScript: () => {
        // Every FunctionalScript extension is discovered, so a module migrated
        // from `.f.ts` to `.f.mjs` keeps its proofs. An ordinary `.mjs` is
        // still skipped.
        /** @type {Dir} */
        const root = {
            '.hidden.f.ts': [],
            'a.f.ts': [],
            'b.f.mjs': [],
            'c.f.mts': [],
            'd.mjs': [],
        }
        const [, result] = virtual({ ...emptyState, root })(allFiles('.', shouldLoad))
        assertEq(unwrap(result).join(','), './a.f.ts,./b.f.mjs,./c.f.mts')
    },
    allFilesSkipsNodeModules: () => {
        // `node_modules` is skipped without descending into it, even though
        // it contains a file that would otherwise match the predicate.
        /** @type {Dir} */
        const root = {
            'node_modules': { 'pkg.f.ts': [] },
            'a.f.ts': [],
        }
        const [, result] = virtual({ ...emptyState, root })(allFiles('.', shouldLoad))
        assertEq(unwrap(result).join(','), './a.f.ts')
    },
    loadModuleMapDefaultsToCwdWhenInitCwdUnset: () => {
        // With no `INIT_CWD` (e.g. `fjs t` invoked outside `npm run`), `env`
        // lookup returns `undefined` and discovery falls back to `.`, so
        // every path keeps its own `./`-prefix instead of having one stripped.
        /** @type {Dir} */
        const root = { 'a.f.ts': () => ({}) }
        const [, result] = virtual({ ...emptyState, root })(loadModuleMap({}))
        assertEq(Object.keys(unwrap(result)).join(','), './a.f.ts')
    },
    loadModuleMapReportsUnreadableRoot: () => {
        // A directory that cannot be listed is no longer a panic. Discovery
        // hands the failure back, and the program that asked for the map is
        // the one that decides what a source tree it cannot read means — for
        // `fjs t` that is a message on `stderr` and exit `1`.
        const [, result] = virtual({ ...emptyState, root: {} })(loadModuleMap({ INIT_CWD: 'missing' }))
        assert(result[0] === 'error', result)
    },
    loadModuleMapReportsUnimportableModule: () => {
        // The other half of the same breaking change, and the half `readdir`
        // does not cover: discovery lists the file, then the import of it
        // fails. `'a.f.ts': []` is content rather than a module, so the
        // virtual runner's `import` refuses it. Without this, a `loadFile`
        // that turned every import failure into a success would still pass
        // every other proof here.
        const [, result] = virtual({ ...emptyState, root: { 'a.f.ts': [] } })(loadModuleMap({}))
        assert(result[0] === 'error', result)
    },
    loadModuleMapStripsInitCwdPrefix: () => {
        // With `INIT_CWD` set (the normal `npm run` case), discovery starts
        // from that subdirectory and each key is relativized against it, so
        // keys are still `./`-relative to `INIT_CWD` rather than carrying it.
        /** @type {Dir} */
        const root = { 'sub': { 'a.f.ts': () => ({}) } }
        const [, result] = virtual({ ...emptyState, root })(loadModuleMap({ INIT_CWD: 'sub' }))
        assertEq(Object.keys(unwrap(result)).join(','), './a.f.ts')
    },
}
