/**
 * Static website generation program: a page per directory of the repository,
 * each carrying the proofs of its own subtree, and the one stylesheet they
 * all link.
 *
 * **Discovery is part of the program, not a script beside it.** Which modules
 * a browser can link is decided by reading their source, which
 * [`./browser-source`](./browser-source/module.f.mjs) answers, and reading a
 * tree is `readdir` and `readFile` — two operations that already existed. So
 * the whole generator is one effect, and a proof drives it against
 * `effects/node/virtual`'s in-memory tree: a directory of fixtures in, a site
 * out, no filesystem touched. What used to check this was running the command
 * and reading a `git diff`.
 *
 * **It costs 42 s where the script it replaced took 1.65 s**, and the whole
 * difference is one function: reading a file through the operation decodes it
 * with `text`'s `utf8ToString`, at ~23 ms per module against ~1 ms for a
 * native read. Nothing here is worth tuning for it — the walk is 0.14 s and
 * the reads themselves 0.1 s — so it is recorded where it belongs, in
 * [`../text/todo/utf8-to-string-cost.md`](../text/todo/utf8-to-string-cost.md),
 * with the measurements and with why fanning the reads out does not help.
 *
 * @module
 *
 * @import { All, ReadFile, Readdir, Write, WriteFile } from '../effects/node/types.ts'
 * @import { Effect, IoChannel } from '../effects/types.ts'
 * @import { StringSet } from '../types/string_set/types.ts'
 * @import { Vec } from '../types/bit_vec/types.ts'
 * @import { _Graph, _Imports, _Tree, _Walked } from './private.ts'
 * @import { Dir, Proof } from './page/types.ts'
 * @import { Node } from '../media/html/types.ts'
 */

import { htmlUtf8 } from '../media/html/module.f.mjs'
import { utf8 } from '../text/module.f.mjs'
import { allOk, exitStep, isNotFound, readdir, readUtf8File, writeFile, writeUtf8File } from '../effects/node/module.f.mjs'
import { foldStep, forEachStep, mapStep, pureError, pureOk, resultStep, step } from '../effects/module.f.mjs'
import { exportsProof, local, specifiers } from './browser-source/module.f.mjs'
import { concat as pathConcat } from '../path/module.f.mjs'
import { at, empty as emptyMap, setReplace } from '../types/ordered_map/module.f.mjs'
import { contains, empty as noPaths, set as addPath, values as paths } from '../types/string_set/module.f.mjs'
import { toArray } from '../types/list/module.f.mjs'
import { log } from '../effects/common/module.f.mjs'
import { stylesheet, stylesheetLink } from './style/module.f.mjs'
import { page, sections, subtree, testSection } from './page/module.f.mjs'

/**
 * The root page: the project's name, the catalogue every directory page
 * carries, and the browser test suite under it.
 *
 * It is the repository root's instance of the page rule rather than a page
 * beside it — the sections are the same ones {@link page} writes — but it
 * keeps its own frame, because the heading and the runner are the site's and
 * not the root directory's.
 *
 * **The catalogue comes first and the test suite last.** What a directory
 * holds is what a reader came for; a run is something they then ask for. It
 * is also the only order in which a run cannot move the catalogue, whatever
 * the report does.
 *
 * The heading is the project, not the suite. The suite is one section of the
 * page — named for what it is, with the prose that introduces it inside —
 * and the page is the repository's root.
 *
 * @type {(dir: Dir) => Vec}
 */
const rootPage = dir => htmlUtf8(
    ['title', 'FunctionalScript'],
    stylesheetLink,
)(
    ['main', { 'data-browser-tests': '', 'data-state': 'idle' },
        ['p', ['a',
            { href: 'https://github.com/functionalscript/functionalscript' },
            'GitHub Repository'
        ]],
        ['h1', 'FunctionalScript'],
        .../** @type {readonly Node[]} */ (sections(dir)),
        .../** @type {readonly Node[]} */ (testSection(dir)([
            ['p',
                'FunctionalScript derives this browser-native unit-test suite from exported proofs. ',
                ['a',
                    { href: 'https://medium.com/javascript-in-plain-english/emergent-testing-in-javascript-e44760d71688' },
                    'Read “Emergent Testing in JavaScript”'
                ],
                '.'
            ],
        ])),
    ],
)

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
 * Every directory under `dir`, itself first, with everything each one holds.
 *
 * A directory at a time rather than `readdir`'s own `recursive` option,
 * because recursion there cannot be pruned: it descends into everything and
 * hands back the whole listing to filter afterwards.
 *
 * **Names are sorted here, once.** Both consumers want a stable order — a
 * page whose proof list reordered itself between runs is a diff nobody made,
 * and so is one whose file list did — and the filesystem promises none.
 *
 * @type {(dir: string) => Effect<Readdir, readonly _Walked[], IoChannel>}
 */
const walk = dir => step(readdir(dir, {}), entries => {
    // `isDirectory` and not `!isFile`: a symbolic link is neither, and
    // `readdir` on one fails with `ENOTDIR` — a build broken by a link
    // somebody left in the tree.
    const files = entries.filter(e => !e.isDirectory).map(e => e.name).toSorted()
    const dirs = entries
        .filter(e => e.isDirectory && !ignored(e.name))
        .map(e => e.name)
        .toSorted()
    return foldStep(
        pureOk(dirs),
        /** @type {readonly _Walked[]} */ ([{ path: dir, files, dirs }]),
        name => found => mapStep(
            walk(pathConcat(dir)(name)),
            inner => [...found, ...inner]))
})

/** @type {(walked: _Walked) => (name: string) => string} */
const inDir = walked => name => pathConcat(walked.path)(name)

/**
 * Every file the walk found, by repository path.
 *
 * @type {(tree: readonly _Walked[]) => readonly string[]}
 */
const allFiles = tree => tree.flatMap(walked => walked.files.map(inDir(walked)))

/**
 * Every authored module the walk found, in path order.
 *
 * @type {(tree: readonly _Walked[]) => readonly string[]}
 */
const authoredModules = tree => allFiles(tree).filter(authored).toSorted()

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
 * **A missing path leaves the graph alone.** The scan is textual, so a module
 * that emits source of its own — this file embeds the page's entry module —
 * offers up import lines that were never its own, and a relative specifier
 * naming no file is the ordinary result. That is the failure this expects, and
 * it is why the deleted `browser-prepare.mjs` swallowed read errors too.
 *
 * **Every other read failure is refused**, because the one that matters is not
 * benign: `readFile` caps a file at 128 KiB, so a module over that size would
 * otherwise read as importing nothing, and a proof reaching it would be
 * selected on the strength of a file nobody read — putting the page's failure
 * *while it links*, before the runner can publish a report, which is the
 * outcome this whole selection exists to prevent. So the generator refuses the
 * input it cannot handle rather than answering with a plausible proof list
 * ([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)), and its
 * message is the host's own, naming the file. Dropping such a module as a
 * *blocker* instead would keep the run going, but it costs a `stat` per module
 * and calls a host failure a property of the source. Nothing in the repository
 * is near the cap today, which is why this is a guard and not a chunked read.
 *
 * Not recording an absent path is also what keeps {@link blockersOf}'s "never
 * read" case a real one rather than a defensive branch nothing can reach. It
 * cannot loop: a module that was not read reaches nothing, so it adds nothing
 * to the frontier it would have to come back through.
 *
 * @type {(path: string) => (acc: readonly [_Graph, readonly string[]]) => Effect<ReadFile, readonly [_Graph, readonly string[]], IoChannel>}
 */
const readModule = path => ([graph, reached]) => step(
    resultStep(readUtf8File(path), read => pureOk(read)),
    read => {
        if (read[0] === 'error') {
            return isNotFound(read[1])
                ? pureOk(/** @type {const} */ ([graph, reached]))
                : pureError(read[1])
        }
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
 * @type {(frontier: readonly string[]) => (graph: _Graph) => Effect<ReadFile, _Graph, IoChannel>}
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
 * modules, which is exactly what a browser can load. Anything else is kept
 * out of what a page loads — and named on it with the blocker, so that an
 * empty list means "no proofs here" and nothing else. Loading it would fail
 * the page *while it links*, before the runner can publish a report, and a
 * proof module is valid FunctionalScript whether or not a browser can link
 * it.
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
 * The browser-realm proof the website ships: a smoke test that the page it
 * generated has a document at all.
 *
 * It is not authored FunctionalScript and the walk does not look for it, so
 * it is named here — as a proof of `fjs/website/`, which is what it is, so
 * that directory's page runs it and every page above runs it too.
 */
const websiteBrowserProof = 'fjs/website/browser.mjs'

/**
 * The browser proof, if this tree has one.
 *
 * Named rather than assumed: a page that lists a source no one can load fails
 * *while it links*, before the runner can publish a report, which is the
 * outcome the whole selection exists to prevent. A fixture tree has no
 * `fjs/website/`, and neither would a checkout of part of this one.
 *
 * @type {(tree: readonly _Walked[]) => readonly string[]}
 */
const browserProofOf = tree =>
    allFiles(tree).includes(websiteBrowserProof) ? [websiteBrowserProof] : []

/**
 * Every proof module the site knows about, each with what stops a browser
 * linking it, in path order.
 *
 * The order is the paths' rather than the walk's, for three reasons that all
 * come from the same place: a directory listing is the filesystem's business,
 * and it differs between machines. Sorting makes two builds of one repository
 * produce identical files, gives every page a list a reader can scan, and
 * runs the proofs in the order `fjs t` runs them so the two reports line up.
 *
 * It is not what makes the slicing work — {@link subtree} filters by prefix
 * and would answer the same in any order. A sorted subtree happens to be a
 * contiguous run; nothing here depends on it.
 *
 * @type {(paths: readonly string[]) => Effect<ReadFile, readonly Proof[], IoChannel>}
 */
const classify = paths => step(
    readGraph(paths)(emptyMap),
    graph => pureOk(paths
        .toSorted()
        .map(name => ({ name, blockers: blockersOf(graph)(name) }))))

/**
 * Says what will not run, and how much will.
 *
 * @type {(proofs: readonly Proof[]) => Effect<Write, void, IoChannel>}
 */
const reportClassification = proofs => {
    const blocked = proofs.filter(proof => proof.blockers.length !== 0)
    return step(
        forEachStep(pureOk(blocked), proof =>
            log(`skipped ${proof.name}: not linkable in a browser (${proof.blockers.join(', ')})`)),
        () => log(`browser proof modules: ${proofs.length - blocked.length} of ${proofs.length}`))
}

/**
 * The proof modules to consider: every authored `.f.mjs` that exports a
 * `proof`, in the path order it was given.
 *
 * @type {(paths: readonly string[]) => Effect<ReadFile, readonly string[], IoChannel>}
 */
const proofModules = paths => foldStep(
    pureOk(paths),
    /** @type {readonly string[]} */ ([]),
    path => found => step(
        readUtf8File(path),
        source => pureOk(exportsProof(source) ? [...found, path] : found)))

/**
 * Whether a name is the generator's own output rather than a file a reader
 * would open. `index.html` and the `_`-prefixed files are written by this
 * program, and `.gitignore` keeps them out of the tree for the same reason a
 * page should keep them out of its listing.
 *
 * @type {(name: string) => boolean}
 */
const generatedName = name =>
    name === 'index.html' || name.startsWith('_') || name.startsWith('.')

/**
 * Whether a name in a `todo/` directory is an issue.
 *
 * An issue is a markdown file — [`todo/README.md`](../../todo/README.md) says
 * so, one file per issue — and a `todo/` may hold something else: the
 * repository root's holds `proof.f.mjs`, an authored module the suite runs,
 * which the page listed as an issue because it was there rather than because
 * it is one. The list says what it means instead of showing whatever the
 * folder happens to contain.
 *
 * @type {(name: string) => boolean}
 */
const isIssue = name => name.endsWith('.md')

/**
 * Whether a directory's contents belong on its parent's page rather than on
 * one of its own.
 *
 * `todo/` is the one such directory: its issues are the parent's open work,
 * and a page of its own would hold nothing else — no module, so no file list,
 * and no `todo/` of its own to list. It is therefore neither given a page nor
 * offered as a subdirectory link, so no link to a missing page can exist.
 *
 * **The whole subtree, not the directory whose own name is `todo`.** The
 * repository root's `todo/` holds four folders of its own, and `todo/demo/`
 * holds a fifth. Excluding only the folder named `todo` gave each of those
 * five a page whose breadcrumb linked `/todo/index.html`, the one page the
 * generator deliberately never writes — five broken links, and the only
 * broken links on the site. What makes an issue folder's contents its
 * parent's business does not stop applying one level down.
 *
 * @type {(path: string) => boolean}
 */
const isTodoDir = path => path.split('/').includes('todo')

/**
 * What a page needs about one directory, from what the walk found in it and
 * in its `todo/`.
 *
 * **Every directory lists its files.** Listing them only where a
 * `module.f.mjs` sat was a guess at which directories hold something a reader
 * would open, and it was wrong on 42 of the 190 pages: `changelog/` has 104
 * release notes and rendered an empty page, `nanvm-lib/src/vm/array/` five
 * Rust sources, `fjs/types/option/` its `types.ts`. What a directory holds is
 * what the walk found in it, minus the generator's own output.
 *
 * @type {(tree: _Tree) => (proofs: readonly Proof[]) => (walked: _Walked) => Dir}
 */
const toDir = tree => proofs => walked => ({
    path: walked.path,
    files: walked.files.filter(name => !generatedName(name)),
    dirs: walked.dirs.filter(name => name !== 'todo'),
    todo: at(pathConcat(walked.path)('todo'))(tree)
        ?.files
        ?.filter(isIssue)
        ?? [],
    proofs: subtree(walked.path)(proofs),
})

/**
 * One `index.html` per directory, so the tree is walkable from the root.
 *
 * The root's page is the site's own — it carries the heading and the test
 * runner — and every other directory's is {@link page}'s. Both write the same
 * catalogue.
 *
 * @type {(tree: readonly _Walked[]) => (proofs: readonly Proof[]) => Effect<WriteFile | Write, void, IoChannel>}
 */
const writePages = tree => proofs => {
    const byPath = tree.reduce(
        (map, walked) => setReplace(walked.path)(walked)(map),
        /** @type {_Tree} */ (emptyMap))
    const dirs = tree.filter(walked => !isTodoDir(walked.path)).map(toDir(byPath)(proofs))
    return step(
        forEachStep(pureOk(dirs), dir => writeFile(
            pathConcat(dir.path)('index.html'),
            dir.path === '.' ? rootPage(dir) : page(dir))),
        () => log(`directory pages: ${dirs.length}`))
}

/** @type {Effect<Readdir | ReadFile | WriteFile | Write | All, 0, number>} */
const program = exitStep(mapStep(
    step(walk('.'), tree => step(
        proofModules(authoredModules(tree)),
        found => step(classify([...found, ...browserProofOf(tree)]), proofs => step(
            reportClassification(proofs),
            () => step(
                writePages(tree)(proofs),
                () => writeUtf8File('_main.css', stylesheet)))))),
    () => undefined))

export const main = () => program
