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
 * **It cost 42 s where the script it replaced took 1.65 s; it costs about
 * 13 s now.** Reading a file through the operation decodes it with `text/utf8`'s
 * `utf8ToString`, at ~23 ms per module against ~1 ms for a native read — the
 * walk itself is 0.14 s and a bare read 0.1 s, so decode count was always the
 * whole story. It is recorded where it belongs, in
 * [`../text/todo/utf8-to-string-cost.md`](../text/todo/utf8-to-string-cost.md),
 * with the measurements and with why fanning the reads out does not help.
 *
 * Every authored module used to be decoded three times over: twice by two
 * near-identical folds, one asking whether it exports a `proof` and the
 * other a `demo`, and a third time when the import graph — needed to find
 * what would stop a browser linking it — was walked from an empty graph and
 * read the same module again just for its specifiers. {@link scan} asks
 * both export questions of one read and keeps the specifiers as a byproduct,
 * and {@link readGraph} is seeded with that, so it reads only what a
 * scan of the {@link isAuthored} modules alone could not already have answered
 * — a non-authored dependency, most often.
 *
 * **An empty page is probably a directory that no longer exists.** The
 * generator only ever writes: a page sits next to the source it describes, so
 * switching away from a branch that added a directory can leave its generated
 * `index.html` behind — git will not remove a directory that still holds a
 * file it does not track — and the next build walks that leftover directory
 * and gives it a page with nothing in it. This is a working-tree condition
 * only; a deploy builds from a fresh checkout, so no stale page ever ships.
 * `git clean -Xd` removes the leftover.
 *
 * @module
 *
 * @import { Access, All, Catch, Env, Import, Mkdir, Module, NodeProgramOptions, ReadFile, ReadWhole, Readdir, Rm, Write, WriteBytes, WriteFile } from '../effects/node/types.ts'
 * @import { Effect, IoChannel, IoResult } from '../effects/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { StringSet } from '../types/string_set/types.ts'
 * @import { _DemoPaths, _Demos, _Graph, _Imports, _Walked } from './private.ts'
 * @import { Header } from './issue/types.ts'
 * @import { OrderedMap } from '../types/ordered_map/types.ts'
 * @import { Build, Dir, PageDemo, Proof } from './page/types.ts'
 * @import { Element } from '../media/html/types.ts'
 * @import { Demo, DemoEvent } from './demo/types.ts'
 * @import { Funding } from './funding/types.ts'
 */

import { utf8 } from '../text/module.f.mjs'
import { access, exitStep, isNotFound, mkdir, readdir, readUtf8File, readWhole, writeChunks, writeFile, writeUtf8File } from '../effects/node/module.f.mjs'
import { errorMessage, foldStep, forEachStep, history, historyStep, ioError, mapStep, pureError, pureOk, resultStep, step } from '../effects/module.f.mjs'
import { exportsDemo, exportsProof, local, specifiers } from './browser-source/module.f.mjs'
import { basename, concat as pathConcat, parent } from '../path/module.f.mjs'
import { resolve } from '../path/import/module.f.mjs'
import { at, empty as emptyMap, entries, setReplace } from '../types/ordered_map/module.f.mjs'
import { contains, empty as noPaths, set as addPath, values as paths } from '../types/string_set/module.f.mjs'
import { toArray } from '../types/list/module.f.mjs'
import { catch_, import_, log } from '../effects/common/module.f.mjs'
import { indexPage, isVersion, releasePage, releasePath, releases } from './changelog/module.f.mjs'
import { tryParse, tryParseBlocks } from '../media/markdown/module.f.mjs'
import { readmeName, readmeNodes, readmeSection, resolveHref } from './readme/module.f.mjs'
import { pageRefusal } from '../media/html/module.f.mjs'
import { error, ok } from '../types/result/module.f.js'
import { stylesheet } from './style/module.f.js'
import { changelogDir, cliDir, demoSection, directoryLayout, fileHref, page, pagePath, prsDir, shell, siteName, subtree, testSection, testsMain } from './page/module.f.mjs'
import { prsPage } from './prs/module.f.mjs'
import { cliPage } from './cli/module.f.mjs'
import { hexText, tryFromHexOf } from '../git/oid/module.f.mjs'
import { fundingPath, parse as parseFunding } from './funding/module.f.mjs'
import { isAuthored, isThirdParty } from '../dev/module.f.mjs'
import { header, isIssue } from './issue/module.f.js'
import { cargoDocDir, cargoDocHref, cargoDocPage, crateHref, crateOf, rustdocDir } from './cargo-doc/module.f.mjs'

/**
 * The root page: the project's name, the catalogue every directory page
 * carries, and the browser test suite under it.
 *
 * It is the repository root's instance of the page rule rather than a page
 * beside it — the sections are the same ones {@link page} writes — but it
 * keeps its own frame, because the heading and the runner are the site's and
 * not the root directory's.
 *
 * **The catalogue sits beside the demo and test suite.** A reader can
 * navigate the directory without a growing demo or report moving its links.
 *
 * The heading is the project, not the suite. The suite is one section of the
 * page — named for what it is, with the prose that introduces it inside —
 * and the page is the repository's root.
 *
 * The repository and the releases are linked from the header every page
 * carries ({@link shell}), not from this page's own frame.
 *
 * @type {(build: Build) => (dir: Dir) => string}
 */
const rootPage = build => dir => shell(build)(siteName)(directoryLayout(build)(dir)(testsMain(
    ['h1', 'FunctionalScript'],
    ...dir.readme,
    ...(dir.demo === null ? [] : demoSection(dir.demo)),
    ...testSection(dir)([
        ['p',
            'FunctionalScript derives this browser-native unit-test suite from exported proofs. ',
            ['a',
                { href: 'https://medium.com/javascript-in-plain-english/emergent-testing-in-javascript-e44760d71688' },
                'Read “Emergent Testing in JavaScript”'
            ],
            '.'
        ],
    ]),
)))

/**
 * Every directory under `dir`, itself first, with everything each one holds;
 * a directory {@link isThirdParty} names is not entered.
 *
 * This is not `fjs/dev`'s `walk`, which answers the flat list of files it
 * takes, a directory it descends not itself in the answer: a page is written
 * for every directory, an empty one included, so this answers a record per
 * directory. The two share the policy of what not to enter, not the recursion.
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
        // The root PR route, the CLI reference and the Rust API reference
        // are generated output, not source directories. Excluding them
        // keeps consecutive builds' catalogues identical.
        .filter(e => e.isDirectory && !isThirdParty(e.name) && !(dir === '.' && (e.name === prsDir || e.name === cliDir || e.name === cargoDocDir)))
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
const authoredModules = tree => allFiles(tree).filter(isAuthored).toSorted()

/**
 * The module a specifier in `from` leads to, or `null` where a browser could
 * not follow it: a bare package, a `node:` builtin, or a relative specifier
 * [`fjs/path/import`](../path/import/module.f.mjs)'s `resolve` refuses.
 *
 * That `resolve` is the one the compiler and the virtual host read imports
 * with, so a specifier means the same file here as there: `./x%20y.mjs` is
 * `x y.mjs`, as a browser's request for it is, and `./bad%` names nothing.
 *
 * @type {(from: string) => (specifier: string) => string | null}
 */
const target = from => specifier => local(specifier) ? resolve(from)(specifier) : null

/**
 * `path`'s own {@link _Imports} record: the modules the specifiers `source`
 * names lead to, and, as written, those that lead nowhere a browser can
 * follow and so would stop it linking whatever reaches them.
 *
 * @type {(path: string) => (source: string) => _Imports}
 */
const importsOf = path => source => {
    const found = specifiers(source).map(specifier => /** @type {const} */ ([specifier, target(path)(specifier)]))
    return {
        blockers: found.flatMap(([specifier, to]) => to === null ? [specifier] : []),
        local: found.flatMap(([, to]) => to === null ? [] : [to]),
    }
}

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
        const imports = importsOf(path)(read[1])
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
 * Demos are classified in the same pass, and from the same graph: a page
 * loads a demo the way it loads a proof, so what would stop one would stop the
 * other. They are answered separately because only proofs are listed.
 *
 * **`graph` is a starting point, not an empty one.** {@link scan} already read
 * every authored module once and built its `_Imports` entry as a byproduct of
 * deciding whether it exports a `proof` or a `demo`; seeding {@link readGraph}
 * with that is what lets its own "already in the graph" skip apply to every
 * proof and demo module too, rather than reading each a second time here.
 *
 * **The frontier also names each root's own local imports, not only
 * `proofs` and `demos` themselves — and only theirs.** `readGraph`
 * discovers a module's imports as the *result* of reading it — the one
 * thing seeding skips. A seeded root's own imports would otherwise never
 * reach the frontier at all: `readGraph` sees it is already in the graph,
 * stops there, and a `.mjs` dependency two hops from a proof — outside
 * `scan`'s reach over the {@link isAuthored} modules — is never read, never
 * refused if it cannot be, and never counted as a blocker either. Widening this to every
 * module `scan` touched, not just the selected roots, would pull in a
 * module that is neither a proof nor a demo nor reachable from one; if
 * such a module imports something `readFile` refuses — over the 128 KiB
 * cap, say — that refusal is not benign like a missing path is, and it
 * would abort the whole build over an import nothing here was going to
 * load anyway.
 *
 * @type {(proofs: readonly string[], demos: readonly string[]) => (graph: _Graph) => Effect<ReadFile, readonly [readonly Proof[], readonly Proof[]], IoChannel>}
 */
const classify = (proofs, demos) => graph => {
    const roots = [...proofs, ...demos]
    return step(
        readGraph([...roots, ...roots.flatMap(path => at(path)(graph)?.local ?? [])])(graph),
        graph => {
            /** @type {(paths: readonly string[]) => readonly Proof[]} */
            const classified = paths => paths
                .toSorted()
                .map(name => ({ name, blockers: blockersOf(graph)(name) }))
            return pureOk(/** @type {const} */ ([classified(proofs), classified(demos)]))
        })
}

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
 * Every authored module, read once: which export a `proof`, which export a
 * `demo`, both in the path order they were given, and each one's own
 * {@link _Imports} entry in the graph {@link classify} would otherwise read
 * it again to build.
 *
 * **One read, not two.** `exportsProof` and `exportsDemo` are the same
 * question with a different name — `exportsBinding`'s own doc says so — so
 * asking both of one already-read source costs nothing a second read would
 * not have cost twice.
 *
 * @type {(paths: readonly string[]) => Effect<ReadFile, readonly [readonly string[], readonly string[], _Graph], IoChannel>}
 */
const scan = paths => foldStep(
    pureOk(paths),
    /** @type {readonly [readonly string[], readonly string[], _Graph]} */ ([[], [], emptyMap]),
    path => ([proofs, demos, graph]) => mapStep(
        readUtf8File(path),
        source => /** @type {const} */ ([
            exportsProof(source) ? [...proofs, path] : proofs,
            exportsDemo(source) ? [...demos, path] : demos,
            setReplace(path)(importsOf(path)(source))(graph),
        ])))

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
 * Each directory's demo, by directory, and what was refused.
 *
 * **Discovery is by export, as it is for a proof**: a module is a demo module
 * if and only if it exports `demo`, so the convention holds whether the demo
 * lives in `demo.f.mjs` or beside the implementation in `module.f.mjs`.
 *
 * **The decision is made once per directory, over all of its candidates.** It
 * was a fold with a nullable lookup standing in for a flag, and that could not
 * hold the rule: a stored `null` and a missing key read the same through `at`,
 * so a third demo in a directory was accepted after the second had refused it,
 * and a blocked demo recorded nothing at all, so a linkable one beside it won.
 * Grouping first makes the rule the shape of the code.
 *
 * **Two in one directory is refused, not resolved**, whether or not both could
 * run. A page has one demo section, and choosing between them — by order, or
 * by which happens to link — is exactly the silent precedence the rule exists
 * to prevent.
 *
 * **A demo a browser cannot link is no demo.** The page loads it as it loads a
 * proof, so the same analysis applies; unlike a proof it has nowhere on the
 * page to be listed with its blocker, so it is dropped and said on the console
 * instead.
 *
 * @type {(demos: readonly Proof[]) => readonly [_DemoPaths, readonly string[]]}
 */
const resolveDemos = demos => {
    /** @type {OrderedMap<readonly Proof[]>} */
    const byDir = demos.reduce(
        (map, demo) => {
            const dir = parent(demo.name)
            return setReplace(dir)(/** @type {readonly Proof[]} */ ([...(at(dir)(map) ?? []), demo]))(map)
        },
        /** @type {OrderedMap<readonly Proof[]>} */ (emptyMap))
    return toArray(entries(byDir)).reduce(
        ([found, refused], [dir, candidates]) => {
            if (candidates.length > 1) {
                return /** @type {const} */ ([found, [...refused,
                    `skipped the demo in ${dir}: ${candidates.length} modules export one`
                    + ` (${candidates.map(demo => demo.name).join(', ')})`]])
            }
            const only = candidates[0]
            if (only.blockers.length !== 0) {
                return /** @type {const} */ ([found, [...refused,
                    `skipped ${only.name}: a demo must link in a browser (${only.blockers.join(', ')})`]])
            }
            return /** @type {const} */ ([setReplace(dir)(`/${only.name}`)(found), refused])
        },
        /** @type {readonly [_DemoPaths, readonly string[]]} */ ([emptyMap, []]))
}

/**
 * A demo module's first view, `view(init)`, as a thunk for `catch_`: a module
 * that exports no `demo`, or a `view` that throws, is a throw here.
 *
 * @type {(module: Module) => () => unknown}
 */
const firstView = module => () => {
    const demo = /** @type {Demo<unknown, DemoEvent>} */ (module.demo)
    return demo.view(demo.init)
}

/**
 * A demo with the first view the build rendered for it — `view(init)`, which
 * the page shows until the runtime has loaded the demo and takes it over.
 *
 * **The demo is imported, not read.** Rendering it means running it, and
 * `import` is the operation that loads a module's exports; the page's own
 * runtime imports the very same module.
 *
 * **A demo that cannot be rendered keeps its page.** One that will not import,
 * exports no `demo`, whose `view` throws, or whose view a page cannot hold
 * ({@link pageRefusal}) is said on the console, and its page
 * gets an empty root, which is what every page had before demos were
 * rendered: the runtime fills it, or shows why it cannot. The build does not
 * stop for one demo, and the reason is not lost.
 *
 * @type {(path: string) => Effect<Import | Catch | Write, PageDemo, IoChannel>}
 */
const prerender = path => {
    /** @type {(reason: string) => Effect<Write, PageDemo, IoChannel>} */
    const skip = reason => mapStep(
        log(`skipped prerendering ${path.slice(1)}: ${reason}`),
        () => ({ path, view: null }))
    // Each link answers the view so far, or the reason there is none, so a
    // failure is carried down the chain rather than branching out of it.
    /** @type {Effect<Import, Result<Module, string>, IoChannel>} */
    const loaded = resultStep(import_(path.slice(1)), imported =>
        pureOk(imported[0] === 'error' ? error(errorMessage(imported[1])) : imported))
    /** @type {Effect<Import | Catch, Result<Element, string>, IoChannel>} */
    const viewed = step(loaded, imported => imported[0] === 'error'
        ? pureOk(imported)
        : mapStep(catch_(firstView(imported[1])), thrown => thrown[0] === 'error'
            ? error(String(thrown[1]))
            // `catch_` is generic, and the generic is lost on the way through
            // `do_`, so what `view` answers comes back as `unknown`.
            : ok(/** @type {Element} */ (thrown[1]))))
    return step(viewed, view => {
        if (view[0] === 'error') { return skip(view[1]) }
        // The runtime's builders refuse what a page would read otherwise, or
        // run; the page's serializer has no such check, so it is made here.
        const refused = pageRefusal(view[1])
        return refused === null ? pureOk({ path, view: view[1] }) : skip(refused)
    })
}

/**
 * Every demo, with its first view: {@link prerender}, one directory at a time.
 *
 * @type {(paths: _DemoPaths) => Effect<Import | Catch | Write, _Demos, IoChannel>}
 */
const prerenderDemos = paths => foldStep(
    pureOk(entries(paths)),
    /** @type {_Demos} */ (emptyMap),
    ([dir, path]) => demos => mapStep(prerender(path), demo => setReplace(dir)(demo)(demos)))

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
 * Whether a demo lives at `path` or anywhere under it — what marks a
 * directory's entry on its parent's page.
 *
 * **A subtree is a prefix, and the test is on the separator**, as it is for
 * proofs: `fjs/types/` and not `fjs/types`.
 *
 * @type {(demos: _Demos) => (path: string) => boolean}
 */
const holdsDemo = demos => path => toArray(entries(demos))
    .some(([dir]) => dir === path || dir.startsWith(`${path}/`))

/**
 * The paths of the directories that hold a crate rustdoc documented: each has
 * a `Cargo.toml`, and {@link crateOf} its path is among `crates`. The root's
 * `Cargo.toml` is the workspace's, and `.` names no crate.
 *
 * @type {(tree: readonly _Walked[]) => (crates: readonly string[]) => readonly string[]}
 */
const crateDirs = tree => crates => tree
    .filter(walked => walked.files.includes('Cargo.toml') && crates.includes(crateOf(walked.path)))
    .map(walked => walked.path)

/**
 * Every issue under a `todo/`, at any depth, with its header, in the walk's
 * order: a `todo/`'s own issues, then each subfolder's.
 *
 * **An issue whose header cannot be read stops the build**, naming the file,
 * rather than being listed without a status or left out — the same answer
 * {@link writeChangelog} gives a release file that does not parse.
 *
 * @type {(tree: readonly _Walked[]) => Effect<ReadFile, readonly { readonly path: string, readonly header: Header }[], IoChannel>}
 */
const readIssues = tree => foldStep(
    pureOk(tree.filter(walked => isTodoDir(walked.path)).flatMap(walked => walked.files.filter(isIssue).map(inDir(walked)))),
    /** @type {readonly { readonly path: string, readonly header: Header }[]} */ ([]),
    path => read => step(readUtf8File(path), text => {
        const found = header(text)
        return found[0] === 'error'
            ? pureError(ioError({ message: `${path}: ${found[1]}` }))
            : pureOk([...read, { path, header: found[1] }])
    }))

/**
 * What a page needs about one directory, from what the walk found in it and
 * in its `todo/`.
 *
 * **Every directory lists its files.** Listing them only where a
 * `module.f.mjs` sat was a guess at which directories hold something a reader
 * would open, and it was wrong on 42 of the 190 pages: `changelog/` has 104
 * release notes and rendered an empty page, `nanvm/lib/src/vm/array/` five
 * Rust sources, `fjs/types/option/` its `types.ts`. What a directory holds is
 * what the walk found in it, minus the generator's own output.
 *
 * **A crate's directory links its API reference, and the directory above it
 * links the reference's index** — `nanvm/lib` its crate, `nanvm` the list of
 * all three — so a reader finds the reference from either. `crates` is
 * {@link crateDirs}'s answer.
 *
 * **Its issues are every one under its `todo/`**, a subfolder's included, each
 * named by its path inside the `todo/`: `todo/blocked/` is issues like the
 * rest, and the folder is part of the name rather than a page of its own.
 *
 * @type {(issues: readonly { readonly path: string, readonly header: Header }[]) => (crates: readonly string[]) => (proofs: readonly Proof[]) => (demos: _Demos) => (walked: _Walked) => Dir}
 */
const toDir = issues => crates => proofs => demos => walked => {
    const dirs = walked.dirs.filter(name => name !== 'todo')
    const todo = `${pathConcat(walked.path)('todo')}/`
    return {
        path: walked.path,
        files: walked.files.filter(name => !generatedName(name)),
        dirs,
        demoDirs: dirs.filter(name => holdsDemo(demos)(pathConcat(walked.path)(name))),
        todo: issues.flatMap(({ path, header }) =>
            path.startsWith(todo) ? [{ name: path.slice(todo.length), ...header }] : []),
        proofs: subtree(walked.path)(proofs),
        readme: [],
        demo: at(walked.path)(demos),
        api: crates.includes(walked.path) ? crateHref(crateOf(walked.path)) : null,
        apiIndex: dirs.some(name => crates.includes(pathConcat(walked.path)(name))) ? cargoDocHref : null,
    }
}

/**
 * A release file's version, or `null` for a file that is not one.
 *
 * The version is the file name, which is why no release file carries a
 * heading. `README.md` and `RELEASE.md` describe the format rather than
 * record a release, and are not versions.
 *
 * @type {(name: string) => string | null}
 */
const versionOf = name => {
    if (!name.endsWith('.md')) { return null }
    const version = name.slice(0, -'.md'.length)
    return isVersion(version) ? version : null
}

/**
 * The release index, and one page per release.
 *
 * **A release page is `_`-prefixed**, because `index.html` and the
 * `_`-prefixed names are the only two a generator may write here: the site
 * serves the repository folder itself, and `.gitignore` keeps exactly those
 * out of the tree. A release is not a directory and cannot take the first
 * name, so it takes the second, as `_main.css` does.
 *
 * **A file that does not parse stops the build**, rather than being skipped
 * into a page that quietly lacks a release. The entry format is a convention
 * the repository keeps ([`changelog/README.md`](../../changelog/README.md)),
 * so a file that breaks it is a mistake to report, not a case to handle.
 *
 * `unreleased/` is not read. It is a directory rather than a release file,
 * so it is passed over by the same rule that passes over `README.md` —
 * nothing here assumes it exists, and nothing assumes it is gone.
 *
 * **The walk is what says which files are there**, rather than a second
 * `readdir` of the same directory. It has already listed them, it lists
 * only files — so `unreleased/`, a directory, is passed over without a rule
 * of its own — and a tree that holds no changelog at all simply is not in
 * it, which is how a build over one gets no release pages rather than no
 * build. The generator's own proofs run it over exactly such a tree.
 *
 * @type {(build: Build) => (tree: readonly _Walked[]) => Effect<ReadFile | Rm | WriteBytes | WriteFile | Write, void, IoChannel>}
 */
const writeChangelog = build => tree => {
    const dir = tree.find(walked => walked.path === changelogDir)
    if (dir === undefined) { return pureOk(undefined) }
    const versions = dir.files.map(versionOf).filter(v => v !== null)
    return step(
        forEachStep(pureOk(releases(versions)), release => step(
            readUtf8File(`${changelogDir}/${release.version}.md`),
            text => {
                const document = tryParse(text)
                return document[0] === 'error'
                    // The build's channel is `IoChannel`, so a refusal of ours
                    // is reported through it rather than beside it: `exitStep`
                    // prints the message and exits 1, as it does for a file
                    // that could not be read.
                    ? pureError(ioError({ message: `changelog/${release.version}.md: ${document[1]}` }))
                    : writeUtf8File(releasePath(release.version), releasePage(build)(release)(document[1]))
            })),
        () => step(
            writeUtf8File(pagePath(changelogDir), indexPage(build)(versions)),
            () => log(`releases: ${versions.length}`)))
}

/**
 * Whether `path` is there, as a result rather than a failure: `access`
 * answers a missing path with an error, which would end the build, and the
 * callers read a missing path as an answer — no docs to copy, no funding to
 * link — and every other error as the failure it is.
 *
 * @type {(path: string) => Effect<Access, IoResult<void>, IoChannel>}
 */
const foundAt = path => resultStep(access(path), found => pureOk(found))

/**
 * One directory of rustdoc's output, copied to the same place under
 * {@link cargoDocDir}, its files byte for byte. Whole and in chunks, because
 * a rustdoc page outgrows one `Vec`.
 *
 * @type {(dir: _Walked) => Effect<Mkdir | ReadWhole | Rm | WriteBytes | WriteFile, void, IoChannel>}
 */
const copyRustdocDir = dir => {
    const to = `${cargoDocDir}${dir.path.slice(rustdocDir.length)}`
    const made = mkdir(to, { recursive: true })
    return step(made, () => forEachStep(pureOk(dir.files), copyRustdocFile(dir.path)(to)))
}

/**
 * One file of rustdoc's output, read whole from directory `from` and written
 * under the same name in `to`.
 *
 * @type {(from: string) => (to: string) => (name: string) => Effect<ReadWhole | Rm | WriteBytes | WriteFile, void, IoChannel>}
 */
const copyRustdocFile = from => to => name => step(
    readWhole(`${from}/${name}`),
    chunks => writeChunks(`${to}/${name}`, chunks))

/**
 * The crates a walk of rustdoc's output documents: each top-level directory
 * with an `index.html`. The others — `static.files`, `src`, `trait.impl` —
 * are rustdoc's shared assets.
 *
 * @type {(tree: readonly _Walked[]) => readonly string[]}
 */
const cratesOf = tree => tree
    .filter(dir => dir.files.includes('index.html') && parent(dir.path) === rustdocDir)
    .map(dir => basename(dir.path))

/** rustdoc's output walked, the walk kept for the steps after it. */
const rustdocWalked = history(walk(rustdocDir))

/** Every directory of rustdoc's output copied under {@link cargoDocDir}. */
const rustdocCopied = historyStep(rustdocWalked, tree => forEachStep(pureOk(tree), copyRustdocDir))

/**
 * rustdoc's output copied, answering the crates it documents.
 *
 * @type {Effect<Readdir | Mkdir | ReadWhole | Rm | WriteBytes | WriteFile, readonly string[], IoChannel>}
 */
const copyRustdocTree = mapStep(rustdocCopied, ([, tree]) => cratesOf(tree))

/** Whether rustdoc's output is there, as a result rather than a failure. */
const rustdocFound = foundAt(rustdocDir)

/**
 * rustdoc's output, copied from {@link rustdocDir} to {@link cargoDocDir} as
 * it is, answering the crates it documents — or `null` when `cargo doc` was
 * not run, which writes nothing and links nothing.
 *
 * **Copied, not served from `target/`**, which holds build artifacts beside
 * the docs; and not produced here, because running `cargo` from the
 * generator is an external tool ([`AGENTS.md` §6](../../AGENTS.md#6-external-tools)).
 * Whoever builds the site runs `cargo doc --no-deps --workspace` first.
 *
 * **Absence is asked of `access`, not of the walk's `readdir`**, whose
 * `ENOENT` the virtual file system the proofs run on does not yet report
 * ([virtual-error-codes](../effects/node/virtual/todo/virtual-error-codes.md)).
 * Any other failure is left to the walk to report, and stops the build.
 *
 * @type {Effect<Access | Readdir | Mkdir | ReadWhole | Rm | WriteBytes | WriteFile, readonly string[] | null, IoChannel>}
 */
const copyRustdoc = step(rustdocFound, found =>
    found[0] === 'error' && isNotFound(found[1]) ? pureOk(null) : copyRustdocTree)

/**
 * The Rust API reference, when there is one: rustdoc's output and the index
 * page over it. Answers the documented crates, none when there is none.
 *
 * @type {(build: Build) => Effect<Access | Readdir | Mkdir | ReadWhole | Rm | WriteBytes | WriteFile | Write, readonly string[], IoChannel>}
 */
const writeCargoDoc = build => step(copyRustdoc, crates =>
    crates === null ? pureOk([]) : writeCargoDocIndex(build)(crates))

/**
 * The index page over the documented crates, answering them.
 *
 * @type {(build: Build) => (crates: readonly string[]) => Effect<Rm | WriteBytes | WriteFile | Write, readonly string[], IoChannel>}
 */
const writeCargoDocIndex = build => crates => {
    const written = writeUtf8File(pagePath(cargoDocDir), cargoDocPage(build)(crates))
    const logged = step(written, () => log(`rust crates: ${crates.length}`))
    return mapStep(logged, () => crates)
}

/**
 * A directory's `README.md` as the top of its page, or nothing where it has
 * none ([`./readme`](./readme/module.f.mjs)).
 *
 * **A README the reader refuses is a note on its page, not a failed build.**
 * A release file's author can rewrite an entry the reader refuses; a README
 * is written for GitHub first, and its directory's page is still worth
 * having without it.
 *
 * @type {(commit: string | null) => (isPage: (path: string) => boolean) => (dir: Dir) => Effect<ReadFile, readonly Element[], IoChannel>}
 */
const readReadme = commit => isPage => dir => {
    if (!dir.files.includes(readmeName)) { return pureOk([]) }
    return step(readUtf8File(pathConcat(dir.path)(readmeName)), text => {
        const blocks = tryParseBlocks(text)
        return pureOk(readmeSection(fileHref(commit)(dir.path)(readmeName))(
            blocks[0] === 'error' ? blocks : readmeNodes(resolveHref(commit)(isPage)(dir.path))(blocks[1])))
    })
}

/**
 * One `index.html` per directory, so the tree is walkable from the root.
 *
 * The root's page is the site's own — it carries the heading and the test
 * runner — and every other directory's is {@link page}'s. Both write the same
 * catalogue.
 *
 * @type {(build: Build) => (tree: readonly _Walked[]) => (crates: readonly string[]) => (proofs: readonly Proof[]) => (demos: _Demos) => Effect<ReadFile | Rm | WriteBytes | WriteFile | Write, void, IoChannel>}
 */
const writePages = build => tree => crates => proofs => demos => step(readIssues(tree), issues => {
    const dirs = tree
        .filter(walked => !isTodoDir(walked.path) && walked.path !== changelogDir)
        .map(toDir(issues)(crateDirs(tree)(crates))(proofs)(demos))
    const pages = [...dirs.map(dir => dir.path), changelogDir]
        .reduce(/** @type {(set: StringSet, path: string) => StringSet} */((set, path) => addPath(path)(set)), noPaths)
    /** @type {(path: string) => boolean} */
    const isPage = path => contains(path)(pages)
    return step(
        forEachStep(pureOk(dirs), dir => step(
            readReadme(build.commit)(isPage)(dir),
            readme => writeUtf8File(
                pagePath(dir.path),
                dir.path === '.' ? rootPage(build)({ ...dir, readme }) : page(build)({ ...dir, readme })))),
        () => log(`directory pages: ${dirs.length}, issues: ${issues.length}`))
})

/**
 * The commit this build is of, as the lowercase hex GitHub links it by, or
 * `null` when the build does not say.
 *
 * **`WORKERS_CI_COMMIT_SHA` is Cloudflare's**, set by Workers Builds on every
 * build it runs, which is how the published site and every branch preview are
 * built. A local build has no such variable, so its links stay on the site it
 * is — which is also the only place its unpushed commits exist.
 *
 * **A value that is not a SHA-1 commit id is refused rather than trusted.** A
 * link built from one is broken on every page, and nothing would say so. The
 * check is `git/oid`'s own reading of an id at the width this repository uses,
 * and writing it back is what makes the spelling lowercase.
 *
 * @type {(env: Env) => string | null}
 */
const commitOf = env => {
    const value = env.WORKERS_CI_COMMIT_SHA
    if (value === undefined) { return null }
    const units = value.split('').map(c => c.charCodeAt(0))
    // `tryFromHex` reads bytes and throws on anything wider; an environment
    // variable can hold any text, so a wider unit is refused before it gets
    // there.
    if (units.some(u => u > 0x7f)) { return null }
    const id = tryFromHexOf(20)(units)
    return id === null ? null : hexText(id)
}

/**
 * The branch this build is of, or `null` when the build does not say.
 *
 * **`WORKERS_CI_BRANCH` is Cloudflare's**, set by Workers Builds beside the
 * commit. It is shown as text and linked segment by segment, so any value is
 * safe to take as it is; an empty one names no branch.
 *
 * @type {(env: Env) => string | null}
 */
const branchOf = env => {
    const value = env.WORKERS_CI_BRANCH
    return value === undefined || value === '' ? null : value
}

/**
 * What the build says about where files link, so a deploy log answers it.
 *
 * @type {(env: Env) => (commit: string | null) => string}
 */
const linksNote = env => commit =>
    commit !== null ? `file links: GitHub at ${commit}`
        : env.WORKERS_CI_COMMIT_SHA === undefined ? 'file links: this site'
            : 'file links: this site, because WORKERS_CI_COMMIT_SHA is not a commit id'

/**
 * The funding channels in `funding.json`, which is there.
 *
 * A file that cannot be linked stops the build, so the published site never
 * quietly lacks a channel.
 *
 * @type {Effect<ReadFile, readonly Funding[], IoChannel>}
 */
const fundingRead = step(readUtf8File(fundingPath), text => {
    const funding = parseFunding(text)
    return funding[0] === 'error'
        ? pureError(ioError({ message: `${fundingPath}: ${funding[1]}` }))
        : pureOk(funding[1])
})

/** Whether `funding.json` is there, as a result rather than a failure. */
const fundingFound = foundAt(fundingPath)

/**
 * The funding channels every page's footer links, read from `funding.json`.
 *
 * **A tree without the file gets no footer rather than no build** — every
 * fixture tree the generator's proofs build is one. Whether it is there is
 * asked of the file system, not of the walk, so a program that writes the
 * site's bars without walking the tree reads the same channels
 * ([`./rustdoc-bars`](./rustdoc-bars/module.f.mjs)).
 *
 * @type {Effect<Access | ReadFile, readonly Funding[], IoChannel>}
 */
const readFunding = step(fundingFound, found =>
    found[0] === 'error' && isNotFound(found[1]) ? pureOk([]) : fundingRead)

/**
 * What a build knows about itself: the commit and the branch the environment
 * names, and the funding channels.
 *
 * Exported for [`./rustdoc-bars`](./rustdoc-bars/module.f.mjs), which writes
 * the bars from the same build the pages get; `_` because that is linkage,
 * not API.
 *
 * @type {(env: Env) => Effect<Access | ReadFile, Build, IoChannel>}
 */
export const _readBuild = env => mapStep(readFunding, funding => ({ commit: commitOf(env), branch: branchOf(env), funding }))

/**
 * The whole build: the walk, then everything written from it.
 *
 * `env` is what the environment says about the build — its commit and
 * branch — and the funding channels are added once the tree has been read,
 * so every page builder receives one whole {@link Build}.
 *
 * @type {(env: Omit<Build, 'funding'>) => (note: string) => Effect<Access | Readdir | ReadFile | ReadWhole | Rm | WriteBytes | WriteFile | Write | All | Mkdir | Import | Catch, 0, number>}
 */
const program = env => note => exitStep(mapStep(
    step(log(note), () => step(walk('.'), tree => step(readFunding, funding => {
        const build = { ...env, funding }
        const authored = authoredModules(tree)
        // One graph over both: a page loads a demo the way it loads a proof,
        // so what would stop one would stop the other.
        const documented = history(writeCargoDoc(build))
        const scanned = historyStep(documented, () => scan(authored))
        return step(scanned, ([[foundProofs, foundDemos, graph], crates]) =>
            step(classify([...foundProofs, ...browserProofOf(tree)], foundDemos)(graph),
                ([proofs, demoProofs]) => {
                    const [demoPaths, refused] = resolveDemos(demoProofs)
                    const reported = step(reportClassification(proofs), () =>
                        forEachStep(pureOk(refused), log))
                    const prerendered = step(reported, () => prerenderDemos(demoPaths))
                    const pages = step(prerendered, demos => writePages(build)(tree)(crates)(proofs)(demos))
                    const changelog = step(pages, () => writeChangelog(build)(tree))
                    const prDirectory = step(changelog, () => mkdir(prsDir, { recursive: true }))
                    const prPage = step(prDirectory, () => writeUtf8File(pagePath(prsDir), prsPage(build)))
                    const cliDirectory = step(prPage, () => mkdir(cliDir, { recursive: true }))
                    const reference = step(cliDirectory, () => writeUtf8File(pagePath(cliDir), cliPage(build)))
                    return step(reference, () => writeUtf8File('_main.css', stylesheet))
                }))
    }))),
    () => undefined))

/** @type {(options: NodeProgramOptions) => Effect<Access | Readdir | ReadFile | ReadWhole | Rm | WriteBytes | WriteFile | Write | All | Mkdir | Import | Catch, 0, number>} */
export const main = ({ env }) => {
    const commit = commitOf(env)
    return program({ commit, branch: branchOf(env) })(linksNote(env)(commit))
}
