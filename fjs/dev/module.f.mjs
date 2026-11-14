/**
 * Development utilities for indexing modules and loading FunctionalScript files.
 *
 * @module
 *
 * @import { Access, All, Dirent, Engine, Env, Import, IoChannel, NodeProgramOptions, Readdir } from '../effects/node/types.ts'
 * @import { Effect } from '../effects/types.ts'
 * @import { LoadedModule, ModuleMap, LoadModuleOperations } from './types.ts'
 */

import { allOk, import_, readdir } from '../effects/node/module.f.js'
import { cmp as strCmp } from '../types/string/module.f.js'
import { fromEntries } from '../types/object/module.f.js'
import { mapStep, pureOk, resultStep, step } from '../effects/module.f.js'
import { join, relativize, toPosix } from '../path/module.f.js'

/**
 * Returns `true` if the file should be loaded for proof discovery.
 *
 * Two symmetrical rules, each covering all four TS/JS module extensions:
 *
 * - **FunctionalScript modules** — anything ending in `.f.ts`, `.f.mts`,
 *   `.f.js`, or `.f.mjs`. They are safe to bulk-load by construction, since
 *   they have no import side effects, so the whole module is loaded and its
 *   internal `proof` export (if any) is discovered. The authored extensions
 *   are `.f.mjs` and, for source the current compiler accepts, the stage-2
 *   `.f.js`; stage 1 removed the last `.f.ts`. The matcher still accepts all
 *   four so that a tree carrying a retired spelling still loads.
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
    isHostProof(s)

/**
 * Authored FunctionalScript source, `.f.mjs` or `.f.js`
 * ([`fjs/compiler/README.md`](../compiler/README.md) defines both). It is
 * pure, so it runs on any engine: this is what a browser page can run, and
 * what proof discovery loads on an engine with a partial host.
 *
 * @type {(path: string) => boolean}
 */
export const isAuthored = path => path.endsWith('.f.mjs') || path.endsWith('.f.js')

/**
 * Opt-in host proofs, including the existing JavaScript/TypeScript spellings.
 * Ordinary host modules and legacy FunctionalScript files are excluded.
 *
 * @type {(path: string) => boolean}
 */
export const isHostProof = path =>
    path.endsWith('proof.ts') || path.endsWith('proof.mts') ||
    path.endsWith('proof.js') || path.endsWith('proof.mjs')

/**
 * Which files proof discovery loads on `engine`.
 *
 * Node, Deno, and Bun run the whole Node host, so discovery loads everything
 * {@link shouldLoad} accepts, the impure proofs included. Any other engine
 * runs a partial host whose `import` cannot load what an impure proof
 * imports — one such proof would fail the whole run — so discovery loads
 * {@link isAuthored} modules only. The rule names the engines that can load
 * everything, so an engine added later starts with the authored set rather
 * than with proofs it cannot import. That is the most such a host can load,
 * not always what it can: the runner compiled to Rust loads only what the
 * compiler supports, and will narrow the set further.
 *
 * @type {(engine: Engine) => (path: string) => boolean}
 */
export const shouldLoadOn = engine =>
    engine === 'node' || engine === 'deno' || engine === 'bun' ? shouldLoad : isAuthored

/**
 * Whether a directory holds other people's files, so that no walk over this
 * repository enters it: a dot-directory holds tooling, `node_modules` holds
 * dependencies, and `target` holds Rust build output.
 *
 * They are skipped **before** a walk descends into them, which is the
 * difference between reading this repository and reading a Rust build tree:
 * `target` alone can hold more files than the repository has, and a directory
 * in there that cannot be read would fail a walk that never wanted to look at
 * it.
 *
 * It is a rule about directories only. Each walk still decides its own files:
 * test discovery skips a dot-file, and the website lists one.
 *
 * @type {(name: string) => boolean}
 */
export const isThirdParty = name =>
    name.startsWith('.') || name === 'node_modules' || name === 'target'

/**
 * Walks the tree under `s` and returns the paths `classify` takes. Each entry
 * is classified by its path (joined onto `s`) and its `Dirent`: `'take'`
 * returns the path, `'descend'` lists a directory, `'skip'` ignores it.
 *
 * `classify` descends only a directory, and tells one by `isDirectory`, not
 * `!isFile`: a symbolic link is neither, and `readdir` on one fails with
 * `ENOTDIR`.
 *
 * @type {(s: string, classify: (path: string, entry: Dirent) => 'take' | 'descend' | 'skip') => Effect<Readdir | All, readonly string[], IoChannel>}
 */
export const walk = (s, classify) => {
    /** @type {(p: string) => Effect<Readdir | All, readonly string[], IoChannel>} */
    const load = p => {
        const listed = step(
            readdir(p, {}),
            d => allOk(...d.flatMap(i => {
                const path = join(p, i.name)
                const action = classify(path, i)
                return action === 'take' ? [pureOk([path])]
                    : action === 'descend' ? [load(path)]
                    : []
            })))
        return mapStep(listed, v => v.flat())
    }
    return load(s)
}

/**
 * Every file under `s` that `predicate` takes, by {@link walk}: a hidden file
 * is skipped, and a directory {@link isThirdParty} names is skipped without
 * descending, since neither is this repository's source. Exported for the
 * checks that discover source the way the test runner does — `fjs compile`
 * with no arguments checks every `.f.js` this finds.
 *
 * @type {(s: string, predicate: (path: string) => boolean) => Effect<Readdir | All, readonly string[], IoChannel>}
 */
export const allFiles = (s, predicate) => walk(s, (path, { name, isDirectory }) =>
    isDirectory ? (isThirdParty(name) ? 'skip' : 'descend')
    : !name.startsWith('.') && predicate(path) ? 'take'
    : 'skip')

/**
 * One file, loaded: its import's `Result` is kept as the entry's value, so a
 * module that will not load is recorded rather than failing the walk.
 *
 * @type {(f: string) => Effect<Access | Import, readonly (readonly [string, LoadedModule])[], never>}
 */
const loadFile = f =>
    resultStep(import_(f), r => pureOk([/** @type {const} */ ([f, r])]))

/**
 * Loads a discovered file list, preserving import failures and sorting the
 * resulting map independently of filesystem enumeration order.
 *
 * @type {(files: readonly string[], prefix: string) => Effect<Access | Import | All, ModuleMap, IoChannel>}
 */
const loadFiles = (files, prefix) => {
    const loaded = allOk(...files.map(loadFile))
    return mapStep(loaded, entries => fromEntries(
        entries
            .flat()
            .map(([k, v]) => /** @type {const} */ ([relativize(prefix, k), v]))
            .toSorted(([a], [b]) => strCmp(a)(b))
    ))
}

/**
 * Loads authored FunctionalScript files immediately inside the actual working
 * directory. Descendants and npm's inherited `INIT_CWD` do not select this
 * single-directory native test suite.
 *
 * @type {() => Effect<LoadModuleOperations, ModuleMap, IoChannel>}
 */
export const loadDirectoryModuleMap = () => {
    const discovered = walk('.', (path, { name, isDirectory }) =>
        isDirectory || name.startsWith('.') || !isAuthored(path) ? 'skip' : 'take')
    return step(discovered, files => loadFiles(files, ''))
}

/**
 * Where discovery starts: `INIT_CWD`, the directory `npm run` was invoked
 * from, when the environment carries it, and `.` otherwise — a runner invoked
 * directly is already where its caller is. In POSIX form on every host, so
 * the paths a walk from it builds are the ones the rest of the system reads.
 *
 * @type {(env: Env) => string}
 */
export const sourceRoot = env => {
    const initCwd = env['INIT_CWD']
    return initCwd === undefined ? '.' : toPosix(initCwd)
}

/**
 * Discovers every file {@link shouldLoadOn} accepts for the host's engine
 * under {@link sourceRoot}, imports them, and returns a map from relative
 * path to module exports.
 *
 * `select` further restricts the engine-supported files. Both predicates are
 * applied during the walk by {@link allFiles}, so a file either one
 * rejects is excluded before any `import()` is attempted — no wasted I/O.
 *
 * The result is sorted by path key using `string.cmp` so the order is
 * deterministic regardless of filesystem traversal order.
 *
 * A directory that cannot be listed propagates instead of panicking, so the
 * program that asked for the map decides what a partial view of the source
 * tree means for it. Discovery reads the whole tree, and a map missing the
 * file it was asked about is worse than no map at all.
 *
 * A module that will not import is not a missing file: it is in the map, as an
 * `error` naming why. Importing a module evaluates it, and a module-level
 * `assert` is a supported place for a check, so a failed import is often a
 * failed test — the test runner reports it as one, beside the module's
 * neighbours, rather than this ending the walk without saying which file it
 * was.
 *
 * @type {(options: Pick<NodeProgramOptions, 'env' | 'engine'>, select?: (path: string) => boolean) => Effect<LoadModuleOperations, ModuleMap, IoChannel>}
 */
export const loadModuleMap = ({ env, engine }, select = shouldLoad) => {
    const supported = shouldLoadOn(engine)
    const s = sourceRoot(env)
    const prefix = s === '.' ? '' : s
    // TODO: there are multiple `all` effects here,
    //       we should consider optimizing them by ALIQ technique or something similar.
    //       For example, we should be able to write it like `allFiles(s).flatMap(loadFile)`,
    //       then an effect runner can batch all file loading operations together.
    return step(
        allFiles(s, path => supported(path) && select(path)),
        files => loadFiles(files, prefix))
}
