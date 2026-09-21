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
 * 13 s now.** Reading a file through the operation decodes it with `text`'s
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
 * `.f.mjs`-only scan could not already have answered — a non-authored
 * dependency, most often.
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
 * @import { All, Env, NodeProgramOptions, ReadFile, Readdir, Write, WriteFile } from '../effects/node/types.ts'
 * @import { Effect, IoChannel } from '../effects/types.ts'
 * @import { StringSet } from '../types/string_set/types.ts'
 * @import { Vec } from '../types/bit_vec/types.ts'
 * @import { _Demos, _Graph, _Imports, _Tree, _Walked } from './private.ts'
 * @import { OrderedMap } from '../types/ordered_map/types.ts'
 * @import { Dir, Proof } from './page/types.ts'
 * @import { Node } from '../media/html/types.ts'
 */

import { htmlUtf8 } from '../media/html/module.f.mjs'
import { utf8 } from '../text/module.f.mjs'
import { allOk, exitStep, isNotFound, readdir, readUtf8File, writeFile, writeUtf8File } from '../effects/node/module.f.mjs'
import { foldStep, forEachStep, mapStep, pureError, pureOk, resultStep, step } from '../effects/module.f.mjs'
import { exportsDemo, exportsProof, local, specifiers } from './browser-source/module.f.mjs'
import { concat as pathConcat } from '../path/module.f.mjs'
import { at, empty as emptyMap, entries, setReplace } from '../types/ordered_map/module.f.mjs'
import { contains, empty as noPaths, set as addPath, values as paths } from '../types/string_set/module.f.mjs'
import { toArray } from '../types/list/module.f.mjs'
import { log } from '../effects/common/module.f.mjs'
import { indexPage, releasePage, releasePath } from './changelog/module.f.mjs'
import { tryParse } from '../media/markdown/module.f.mjs'
import { faviconLinks, stylesheet, stylesheetLink } from './style/module.f.mjs'
import { demoSection, page, repository, sections, subtree, testSection } from './page/module.f.mjs'
import { toHex, tryFromHexOf } from '../git/oid/module.f.mjs'

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
 * @type {(commit: string | null) => (dir: Dir) => Vec}
 */
const rootPage = commit => dir => htmlUtf8(
    ['title', 'FunctionalScript'],
    stylesheetLink,
    ...faviconLinks,
)(
    ['main', { 'data-browser-tests': '', 'data-state': 'idle' },
        ['p', ['a', { href: repository }, 'GitHub Repository']],
        ['h1', 'FunctionalScript'],
        // The releases are linked here as well as in the catalogue below,
        // where 'changelog/' is a directory among twenty. A reader looking
        // for what changed in the version they have is looking for a
        // release note, not for the folder it is filed in.
        ['p', ['a', { href: '/changelog/index.html' }, 'Releases']],
        .../** @type {readonly Node[]} */ (sections(commit)(dir)),
        .../** @type {readonly Node[]} */ (dir.demo === null ? [] : demoSection(dir.demo)),
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
 * `path`'s own {@link _Imports} record: which of the specifiers `source`
 * names are local, resolved against `path`, and which are not and so would
 * stop a browser linking whatever reaches them.
 *
 * @type {(path: string) => (source: string) => _Imports}
 */
const importsOf = path => source => {
    const found = specifiers(source)
    return {
        blockers: found.filter(specifier => !local(specifier)),
        local: found.filter(local).map(resolve(path)),
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
 * `scan`'s `.f.mjs`-only reach — is never read, never refused if it cannot
 * be, and never counted as a blocker either. Widening this to every
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
    path => ([proofs, demos, graph]) => step(
        readUtf8File(path),
        source => pureOk(/** @type {const} */ ([
            exportsProof(source) ? [...proofs, path] : proofs,
            exportsDemo(source) ? [...demos, path] : demos,
            setReplace(path)(importsOf(path)(source))(graph),
        ]))))

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
 * The directory a module lives in: `fjs/crypto/sha2` for its `demo.f.mjs`,
 * and `.` for a module at the root.
 *
 * @type {(path: string) => string}
 */
const dirOf = path => {
    const at = path.lastIndexOf('/')
    return at === -1 ? '.' : path.slice(0, at)
}

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
 * @type {(demos: readonly Proof[]) => readonly [_Demos, readonly string[]]}
 */
const resolveDemos = demos => {
    /** @type {OrderedMap<readonly Proof[]>} */
    const byDir = demos.reduce(
        (map, demo) => {
            const dir = dirOf(demo.name)
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
        /** @type {readonly [_Demos, readonly string[]]} */ ([emptyMap, []]))
}

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
 * @type {(tree: _Tree) => (proofs: readonly Proof[]) => (demos: _Demos) => (walked: _Walked) => Dir}
 */
const toDir = tree => proofs => demos => walked => ({
    path: walked.path,
    files: walked.files.filter(name => !generatedName(name)),
    dirs: walked.dirs.filter(name => name !== 'todo'),
    todo: at(pathConcat(walked.path)('todo'))(tree)
        ?.files
        ?.filter(isIssue)
        ?? [],
    proofs: subtree(walked.path)(proofs),
    demo: at(walked.path)(demos),
})

/**
 * The directory the release history is kept in. Its page is written by
 * {@link writeChangelog} rather than by {@link writePages}: a reader who
 * opens the changelog wants the releases, not the names of the files they
 * are stored under, and those files are one click away on GitHub where every
 * other file of the repository is.
 */
const changelogDir = 'changelog'

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
    return version.length !== 0 && !isNaN(Number(version[0])) ? version : null
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
 * @type {(tree: readonly _Walked[]) => Effect<ReadFile | WriteFile | Write, void, IoChannel>}
 */
const writeChangelog = tree => {
    const dir = tree.find(walked => walked.path === changelogDir)
    if (dir === undefined) { return pureOk(undefined) }
    const versions = dir.files.map(versionOf).filter(v => v !== null)
    return step(
        forEachStep(pureOk(versions), version => step(
            readUtf8File(`${changelogDir}/${version}.md`),
            text => {
                const document = tryParse(text)
                return document[0] === 'error'
                    ? pureError(`changelog/${version}.md: ${document[1]}`)
                    : writeFile(releasePath(version), releasePage(version)(document[1]))
            })),
        () => step(
            writeFile(`${changelogDir}/index.html`, indexPage(versions)),
            () => log(`releases: ${versions.length}`)))
}

/**
 * One `index.html` per directory, so the tree is walkable from the root.
 *
 * The root's page is the site's own — it carries the heading and the test
 * runner — and every other directory's is {@link page}'s. Both write the same
 * catalogue.
 *
 * @type {(commit: string | null) => (tree: readonly _Walked[]) => (proofs: readonly Proof[]) => (demos: _Demos) => Effect<WriteFile | Write, void, IoChannel>}
 */
const writePages = commit => tree => proofs => demos => {
    const byPath = tree.reduce(
        (map, walked) => setReplace(walked.path)(walked)(map),
        /** @type {_Tree} */ (emptyMap))
    const dirs = tree
        .filter(walked => !isTodoDir(walked.path) && walked.path !== changelogDir)
        .map(toDir(byPath)(proofs)(demos))
    return step(
        forEachStep(pureOk(dirs), dir => writeFile(
            pathConcat(dir.path)('index.html'),
            dir.path === '.' ? rootPage(commit)(dir) : page(commit)(dir))),
        () => log(`directory pages: ${dirs.length}`))
}

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
    return id === null ? null : String.fromCharCode(...toArray(toHex(id)))
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

/** @type {(commit: string | null) => (note: string) => Effect<Readdir | ReadFile | WriteFile | Write | All, 0, number>} */
const program = commit => note => exitStep(mapStep(
    step(log(note), () => step(walk('.'), tree => {
        const authored = authoredModules(tree)
        // One graph over both: a page loads a demo the way it loads a proof,
        // so what would stop one would stop the other.
        return step(scan(authored), ([foundProofs, foundDemos, graph]) =>
            step(classify([...foundProofs, ...browserProofOf(tree)], foundDemos)(graph),
                ([proofs, demoProofs]) => {
                    const [demos, refused] = resolveDemos(demoProofs)
                    return step(reportClassification(proofs), () =>
                        step(forEachStep(pureOk(refused), log), () =>
                            step(writePages(commit)(tree)(proofs)(demos), () =>
                                step(writeChangelog(tree), () =>
                                    writeUtf8File('_main.css', stylesheet)))))
                }))
    })),
    () => undefined))

/** @type {(options: NodeProgramOptions) => Effect<Readdir | ReadFile | WriteFile | Write | All, 0, number>} */
export const main = ({ env }) => {
    const commit = commitOf(env)
    return program(commit)(linksNote(env)(commit))
}
