/**
 * Static website generation program: the landing page, the browser test
 * entry module, and the manifest of proof modules that page loads.
 *
 * **Discovery is part of the program, not a script beside it.** Which modules
 * a browser can link is decided by reading their source, which
 * [`./browser-source`](./browser-source/module.f.mjs) answers, and reading a
 * tree is `readdir` and `readFile` — two operations that already existed. So
 * the whole generator is one effect, and a proof drives it against
 * `effects/node/virtual`'s in-memory tree: a directory of fixtures in, a
 * manifest out, no filesystem touched. What used to check this was running the
 * command and reading a `git diff`.
 *
 * @module
 *
 * @import { All, ReadFile, Readdir, Write, WriteFile } from '../effects/node/types.ts'
 * @import { Effect, IoChannel } from '../effects/types.ts'
 * @import { StringSet } from '../types/string_set/types.ts'
 * @import { _Graph, _Imports } from './private.ts'
 */

import { htmlUtf8 } from '../media/html/module.f.mjs'
import { utf8 } from '../text/module.f.mjs'
import { allOk, exitStep, readdir, readUtf8File, writeFile, writeUtf8File } from '../effects/node/module.f.mjs'
import { foldStep, forEachStep, mapStep, pureOk, resultStep, step } from '../effects/module.f.mjs'
import { exportsProof, local, specifiers } from './browser-source/module.f.mjs'
import { concat as pathConcat } from '../path/module.f.mjs'
import { at, empty as noModules, setReplace } from '../types/ordered_map/module.f.mjs'
import { contains, empty as noPaths, set as addPath, values as paths } from '../types/string_set/module.f.mjs'
import { toArray } from '../types/list/module.f.mjs'
import { log } from '../effects/common/module.f.mjs'

const html = htmlUtf8(
    ['title', 'Emergent Testing in the Browser'],
    ['style', `
:root { color-scheme: light dark; --bg: white; --text: black; --pass: #137333; --fail: #b3261e }
@media (prefers-color-scheme: dark) {
    :root { --bg: #121212; --text: #f1f1f1; --pass: #81c995; --fail: #f28b82 }
}
body { background-color: var(--bg); color: var(--text); font: 16px system-ui; margin: 3rem auto; max-width: 48rem; padding: 0 1rem }
[data-state="passed"] [data-test-summary] { color: var(--pass) }
[data-state="failed"] [data-test-summary], [data-state="infrastructure-error"] [data-test-summary] { color: var(--fail) }
[data-test-results] { color: var(--text) }
[data-status="passed"]::marker { color: var(--pass) }
[data-status="failed"] { color: var(--fail) }
pre { white-space: pre-wrap }
`]
)(
    ['main', { 'data-browser-tests': '', 'data-state': 'idle' },
        ['p', ['a',
            { href: 'https://github.com/functionalscript/functionalscript' },
            'GitHub Repository'
        ]],
        ['h1', 'Emergent Testing in the Browser'],
        ['p',
            'FunctionalScript derives this browser-native unit-test suite from exported proofs. ',
            ['a',
                { href: 'https://medium.com/javascript-in-plain-english/emergent-testing-in-javascript-e44760d71688' },
                'Read “Emergent Testing in JavaScript”'
            ],
            '.'
        ],
        ['p', { 'data-test-summary': '' }, 'Idle. Press Run to start the suite.'],
        ['button', { type: 'button', 'data-test-run': '' }, 'Run'],
        ['pre', ['ol', { 'data-test-results': '' }]]
    ],
    ['script', { type: 'module', src: './_browser-test-entry.mjs' }]
)

const entry = utf8(`import { startBrowserTestSources } from './fjs/emergent_testing/browser/module.mjs'
import { browserProofSources } from './fjs/emergent_testing/_browser-suite.mjs'

const root = /** @type {Element} */ (document.querySelector('[data-browser-tests]'))
const sources = [...browserProofSources, './fjs/website/browser.mjs']
const runButton = /** @type {Element} */ (document.querySelector('[data-test-run]'))
const start = () => startBrowserTestSources(root, sources)
runButton.addEventListener('click', start)
`)

/** Where the generated manifest goes, and what the page imports it as. */
const manifestPath = 'fjs/emergent_testing/_browser-suite.mjs'

/**
 * Whether a directory is this repository's source at all.
 *
 * `node_modules` holds other people's, `target` holds build output, and a
 * dot-directory holds tooling. They are skipped **before** the walk descends
 * into them, which is the difference between reading this repository and
 * reading a Rust build tree: `target` alone can hold more files than the
 * repository has, and a directory in there that cannot be read would fail a
 * build that never wanted to look at it.
 *
 * @type {(name: string) => boolean}
 */
const ignored = name =>
    name.startsWith('.') || name === 'node_modules' || name === 'target'

/** @type {(path: string) => boolean} */
const authored = path => path.endsWith('.f.mjs')

/**
 * Every authored module under `dir`, walked one directory at a time.
 *
 * A directory at a time rather than `readdir`'s own `recursive` option,
 * because recursion there cannot be pruned: it descends into everything and
 * hands back the whole listing to filter afterwards.
 *
 * @type {(dir: string) => Effect<Readdir, readonly string[], IoChannel>}
 */
const walk = dir => step(readdir(dir, {}), entries => foldStep(
    pureOk(entries),
    /** @type {readonly string[]} */ ([]),
    entry => found => {
        const path = pathConcat(dir)(entry.name)
        // `isDirectory` and not `!isFile`: a symbolic link is neither, and
        // `readdir` on one fails with `ENOTDIR` — a build broken by a link
        // somebody left in the tree.
        if (!entry.isDirectory) { return pureOk(authored(path) ? [...found, path] : found) }
        return ignored(entry.name)
            ? pureOk(found)
            : mapStep(walk(path), inner => [...found, ...inner])
    }))

/**
 * A specifier resolved against the module that wrote it: `./x.f.mjs` in
 * `fjs/a/module.f.mjs` is `fjs/a/x.f.mjs`.
 *
 * `${from}/..` is the module's directory said as a path — `concat` normalizes
 * its left side before joining, so the `..` cancels the file name.
 *
 * @type {(from: string) => (specifier: string) => string}
 */
const resolve = from => specifier => pathConcat(`${from}/..`)(specifier)

/**
 * Reads one module into the graph, and answers what it newly reaches.
 *
 * **A read that fails leaves the graph alone.** The scan is textual, so a
 * module that emits source of its own — this file embeds the page's entry
 * module — offers up import lines that were never its own, and a relative
 * specifier naming no file is one of them. That is the failure this expects,
 * and it is why the deleted script swallowed read errors too.
 *
 * It swallows *every* read failure, and one of them is not benign: `readFile`
 * caps a file at 128 KiB, so a module over that size is read as importing
 * nothing and could put a proof into the manifest on the strength of a file
 * nobody read. No `.f.mjs` here is close to the cap, and refusing it is not
 * written as a guard because nothing could pin one — the virtual interpreter
 * answers every failed read with `ENOENT`, so the other branch would be
 * unreachable under a 100% gate. Recorded in
 * [`./todo/oversized-module-reads-as-empty.md`](./todo/oversized-module-reads-as-empty.md).
 *
 * Not recording the path is also what keeps {@link blockersOf}'s "never read"
 * case a real one rather than a defensive branch nothing can reach. It cannot
 * loop: a module that was not read reaches nothing, so it adds nothing to the
 * frontier it would have to come back through.
 *
 * @type {(path: string) => (acc: readonly [_Graph, readonly string[]]) => Effect<ReadFile, readonly [_Graph, readonly string[]], never>}
 */
const readModule = path => ([graph, reached]) => step(
    resultStep(readUtf8File(path), read => pureOk(read)),
    read => {
        if (read[0] === 'error') { return pureOk(/** @type {const} */ ([graph, reached])) }
        const found = specifiers(read[1])
        /** @type {_Imports} */
        const imports = {
            blockers: found.filter(specifier => !local(specifier)),
            local: found.filter(local).map(resolve(path)),
        }
        return pureOk(/** @type {const} */ ([
            setReplace(path)(imports)(graph),
            [...reached, ...imports.local],
        ]))
    })

/**
 * Reads every module reachable from `frontier`, one at a time, skipping what
 * the graph already holds — which is also what makes an import cycle
 * terminate.
 *
 * One module is read once however many others import it. That is the whole
 * reason the graph is built before it is asked any questions: the alternative,
 * walking each proof module's closure separately, re-reads the shared half of
 * this repository once per proof.
 *
 * @type {(frontier: readonly string[]) => (graph: _Graph) => Effect<ReadFile, _Graph, never>}
 */
const readGraph = frontier => graph => {
    const next = frontier.filter(path => at(path)(graph) === null)
    if (next.length === 0) { return pureOk(graph) }
    return step(
        foldStep(pureOk(next), /** @type {readonly [_Graph, readonly string[]]} */ ([graph, []]), readModule),
        ([read, reached]) => readGraph(reached)(read))
}

/**
 * The specifiers that would stop a browser linking `path`, gathered from its
 * whole reachable graph and deduplicated.
 *
 * A path the graph never recorded contributes nothing: it is a relative
 * specifier that named no file, which the textual scan produces and a browser
 * never sees.
 *
 * Empty means the module and everything it imports are plain relative ES
 * modules, which is exactly what a browser can load. Anything else is dropped
 * from the manifest: emitting it would fail the page *while it links*, before
 * the runner can publish a report, and a proof module is valid FunctionalScript
 * whether or not a browser can link it.
 *
 * @type {(graph: _Graph) => (path: string) => readonly string[]}
 */
const blockersOf = graph => path => {
    /** @type {(frontier: readonly string[], visited: StringSet, found: StringSet) => StringSet} */
    const reach = (frontier, visited, found) => {
        const next = frontier.filter(p => !contains(p)(visited))
        if (next.length === 0) { return found }
        return reach(
            next.flatMap(p => at(p)(graph)?.local ?? []),
            next.reduce((set, p) => addPath(p)(set), visited),
            next.flatMap(p => at(p)(graph)?.blockers ?? [])
                .reduce((set, blocker) => addPath(blocker)(set), found))
    }
    return toArray(paths(reach([path], noPaths, noPaths)))
}

/**
 * The manifest module's source: the sources the page loads, in path order.
 *
 * @type {(selected: readonly string[]) => string}
 */
const manifestSource = selected => [
    '/** Generated browser proof source map. Modules are loaded after the page renders. */',
    '',
    '/** @type {readonly string[]} */',
    'export const browserProofSources = [',
    ...selected.map(path => `    './${path}',`),
    ']',
    '',
].join('\n')

/**
 * Finds the proof modules a browser can link, writes the manifest, and reports
 * what it skipped and why.
 *
 * @type {(paths: readonly string[]) => Effect<ReadFile | Write | WriteFile, void, IoChannel>}
 */
const writeManifest = paths => step(
    readGraph(paths)(noModules),
    graph => {
        const classified = paths.map(path =>
            /** @type {const} */ ([path, blockersOf(graph)(path)]))
        const selected = classified.flatMap(([path, blockers]) =>
            blockers.length === 0 ? [path] : [])
        return step(
            writeUtf8File(manifestPath, manifestSource(selected)),
            () => step(
                forEachStep(
                    pureOk(classified.filter(([, blockers]) => blockers.length !== 0)),
                    ([path, blockers]) =>
                        log(`skipped ${path}: not linkable in a browser (${blockers.join(', ')})`)),
                () => log(`browser proof modules: ${selected.length} of ${classified.length}`)))
    })

/**
 * The proof modules to consider: every authored `.f.mjs` in the tree that
 * exports a `proof`, in path order.
 *
 * The order is the manifest's, and it is the paths' rather than the walk's: a
 * directory listing is the filesystem's business, and a manifest that
 * reordered itself between runs would show up as a diff nobody made.
 *
 * @type {Effect<Readdir | ReadFile, readonly string[], IoChannel>}
 */
const proofModules = step(
    walk('.'),
    paths => foldStep(
        pureOk(paths.toSorted()),
        /** @type {readonly string[]} */ ([]),
        path => found => step(
            readUtf8File(path),
            source => pureOk(exportsProof(source) ? [...found, path] : found))))

/** @type {Effect<Readdir | ReadFile | WriteFile | Write | All, 0, number>} */
const program = exitStep(mapStep(
    step(proofModules, paths => step(writeManifest(paths), () => allOk(
        writeFile('index.html', html),
        writeFile('_browser-test-entry.mjs', entry)))),
    () => undefined))

export const main = () => program
