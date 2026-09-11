/**
 * @import { Dir, State, _Entity } from '../effects/node/virtual/types.ts'
 * @import { Vec } from '../types/bit_vec/types.ts'
 */

import { exitCode } from '../effects/node/module.f.mjs'
import { main } from './module.f.mjs'
import { emptyState, virtual } from '../effects/node/virtual/module.f.mjs'
import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../asserts/module.f.mjs'
import { utf8, utf8ToString } from '../text/module.f.mjs'
import { maxLengthBytes, vec } from '../types/bit_vec/module.f.mjs'
import { stylesheet } from './style/module.f.mjs'

/**
 * A file in the virtual tree, from its text.
 *
 * @type {(text: string) => readonly Vec[]}
 */
const file = text => [utf8(text)]

/** @type {(entity: _Entity | undefined, name: string) => string} */
const textOf = (entity, name) => {
    assert(entity instanceof Array, `expected ${name} to be a file`)
    return entity.map(value => utf8ToString(/** @type {Vec} */ (value))).join('')
}

/**
 * Runs the whole generator over an in-memory tree — which is what moving
 * discovery into FunctionalScript bought: a directory of fixtures in, a site
 * out, no filesystem touched.
 *
 * @type {(tree: Dir) => readonly [State, number]}
 */
const run = tree => {
    const [generated, result] = virtual({ ...emptyState, root: tree })(main())
    return [generated, exitCode(result)]
}

/**
 * The pages a successful run wrote, and what it said while writing them.
 *
 * @type {(tree: Dir) => { readonly root: Dir, readonly output: string }}
 */
const generate = tree => {
    const [generated, code] = run(tree)
    assertEq(code, 0)
    return { root: generated.root, output: generated.stdout }
}

/**
 * The proof sources a page's own runner script loads, in its order.
 *
 * @type {(page: string) => readonly string[]}
 */
const listed = page => page
    .split('\n')
    .flatMap(line => line.startsWith("    './") ? [line.slice(7, -2)] : [])

/** @type {(root: Dir, path: readonly string[]) => string} */
const pageAt = (root, path) => textOf(
    path.reduce((at, name) => /** @type {Dir} */ (at[name]), root)['index.html'],
    `the page for ${path.join('/')}`)

export const proof = {
    main: () => {
        assertNotNullish(main(), 'expected a program effect')
    },
    selection: {
        // Every `.f.mjs` that exports a `proof` and imports nothing a browser
        // cannot resolve, in path order — and nothing else in the tree.
        selectsProofModules: () => {
            const { root, output } = generate({
                a: {
                    'module.f.mjs': file('export const x = 1'),
                    'proof.f.mjs': file("export const proof = { t: () => {} }"),
                },
                'b.f.mjs': file('export const proof = []'),
                'c.mjs': file('export const proof = []'),
            })
            assertStructurallySame(listed(pageAt(root, [])), ['a/proof.f.mjs', 'b.f.mjs'])
            assert(output.includes('browser proof modules: 2 of 2'), output)
        },
        // A module a browser cannot link is dropped rather than emitted, with
        // the reason said out loud: emitting it would fail the page *while it
        // links*, before the runner can publish a report.
        dropsWhatABrowserCannotLink: () => {
            const { root, output } = generate({
                'a.f.mjs': file("import 'node:fs'\nexport const proof = []"),
                'b.f.mjs': file("import 'left-pad'\nexport const proof = []"),
            })
            assertStructurallySame(listed(pageAt(root, [])), [])
            assert(output.includes('skipped a.f.mjs: not linkable in a browser (node:fs)'), output)
            assert(output.includes('skipped b.f.mjs: not linkable in a browser (left-pad)'), output)
            assert(output.includes('browser proof modules: 0 of 2'), output)
        },
        /**
         * **A blocker is inherited through the whole import graph**, which is
         * the reason the scan reads more than the proof modules themselves: a
         * page links a module's imports too, so a proof that is clean on its
         * own face and imports something that is not cannot be loaded either.
         */
        blockersReachThroughImports: () => {
            const { root } = generate({
                'a.f.mjs': file("import './dep.f.mjs'\nexport const proof = []"),
                'dep.f.mjs': file("import 'node:fs'\nexport const x = 1"),
            })
            assertStructurallySame(listed(pageAt(root, [])), [])
        },
        // An import cycle terminates: a module already read is not read again,
        // which is the same skip that keeps one module read once however many
        // others import it.
        importCycleTerminates: () => {
            const { root } = generate({
                'a.f.mjs': file("import './b.f.mjs'\nexport const proof = []"),
                'b.f.mjs': file("import './a.f.mjs'\nexport const x = 1"),
            })
            assertStructurallySame(listed(pageAt(root, [])), ['a.f.mjs'])
        },
        /**
         * **A relative specifier naming no file is not a blocker.** The scan is
         * textual, so a module that emits source of its own — the website
         * generator embeds the page's entry module — offers up import lines
         * that were never its own. Nothing can be read at that path, and
         * nothing is what it contributes.
         */
        aSpecifierNamingNoFileIsDropped: () => {
            const { root } = generate({
                'a.f.mjs': file("import './gone.f.mjs'\nexport const proof = []"),
            })
            assertStructurallySame(listed(pageAt(root, [])), ['a.f.mjs'])
        },
        /**
         * **A read that failed for any other reason stops the generator.** A
         * file over `readFile`'s 128 KiB cap is the one that matters: swallowed,
         * it reads as a module importing nothing, so its own blockers are
         * invisible and a proof reaching it is selected on the strength of a
         * file nobody read — and the page then fails while it links, which is
         * the outcome the selection exists to prevent.
         *
         * The oversized file here is a `.mjs`, because that is the case only
         * this guard catches: an oversized `.f.mjs` is walked, so
         * `proofModules` reads it and fails first.
         */
        anUnreadableModuleIsRefused: () => {
            const [generated, code] = run({
                'a.f.mjs': file("import './big.mjs'\nexport const proof = []"),
                // One chunk at the cap plus one bit over it: `readFile` refuses
                // the file rather than answering with part of it.
                'big.mjs': [vec(maxLengthBytes * 8n)(0n), vec(1n)(1n)],
            })
            assertEq(code, 1)
            // The operator is told which file broke the build, not merely that
            // one did: the message is the host's own and names the entry.
            assertEq(
                generated.stderr,
                `File size exceeds maximum allowed size of ${maxLengthBytes} bytes: 'big.mjs'\n`)
        },
        /**
         * **The browser proof takes its place in path order.** It is appended
         * after the walk's own findings rather than discovered among them, so
         * without a sort it lands last on every page that carries it — a list
         * in path order except for one entry, which is the diff nobody made.
         */
        theBrowserProofSortsIntoPlace: () => {
            const { root } = generate({
                fjs: {
                    website: { 'browser.mjs': file('export const proof = {}') },
                    'z.f.mjs': file('export const proof = []'),
                },
            })
            assertStructurallySame(listed(pageAt(root, [])),
                ['fjs/website/browser.mjs', 'fjs/z.f.mjs'])
        },
        // Where the sources are is the tree's business: a nested directory is
        // walked, and its path is what the root page loads it by.
        walksNestedDirectories: () => {
            const { root } = generate({
                fjs: { types: { list: { 'proof.f.mjs': file('export const proof = []') } } },
            })
            assertStructurallySame(listed(pageAt(root, [])), ['fjs/types/list/proof.f.mjs'])
        },
        /**
         * **Three directories are not this repository's source**, and the test
         * is by segment rather than by prefix — so a `node_modules` nested
         * anywhere is ignored too, which is exactly where one is found.
         */
        ignoresForeignDirectories: () => {
            const { root } = generate({
                node_modules: { 'a.f.mjs': file('export const proof = []') },
                target: { 'b.f.mjs': file('export const proof = []') },
                '.git': { 'c.f.mjs': file('export const proof = []') },
                fjs: {
                    node_modules: { 'd.f.mjs': file('export const proof = []') },
                    'e.f.mjs': file('export const proof = []'),
                },
            })
            assertStructurallySame(listed(pageAt(root, [])), ['fjs/e.f.mjs'])
        },
    },
    pages: {
        /**
         * **Every directory the walk visits gets a page**, so every
         * subdirectory link a page writes resolves. `a/` holds no
         * `module.f.mjs` and still has one — it is the directory that used to
         * be linked to a page nobody generated.
         */
        onePerDirectory: () => {
            const [generated] = run({
                a: { b: { 'module.f.mjs': file('export const x = 1') } },
            })
            const dir = /** @type {Dir} */ (generated.root['a'])
            assert('index.html' in generated.root, 'expected a root page')
            assert('index.html' in dir, 'expected a page for the module-less directory')
            assert('index.html' in /** @type {Dir} */ (dir['b']), 'expected a page for the module directory')
        },
        /**
         * **A file list only where a `module.f.mjs` is**, and the generator's
         * own output is never in it: a page that listed `index.html` or
         * `_main.css` would be listing itself and its stylesheet as source.
         */
        listsAuthoredFilesOnly: () => {
            const [generated] = run({
                a: {
                    'module.f.mjs': file('export const x = 1'),
                    'types.ts': file('export type X = 1'),
                    'notes.md': file('# notes'),
                },
            })
            const page = textOf(/** @type {Dir} */ (generated.root['a'])['index.html'], 'the page')
            assert(page.includes('>module.f.mjs</a>'), page)
            assert(page.includes('>types.ts</a>'), page)
            assert(page.includes('>notes.md</a>'), page)
            assert(!page.includes('>index.html</a>'), page)
            assert(!page.includes('>_main.css</a>'), page)
        },
        /**
         * **A directory lists its files whether or not a module sits among
         * them.** Requiring a `module.f.mjs` was a guess at which directories
         * hold something a reader would open, and it was wrong wherever the
         * content is not FunctionalScript — `changelog/`, with 104 release
         * notes, rendered an empty page.
         */
        listsFilesWithoutAModule: () => {
            const [generated] = run({
                a: { 'notes.md': file('# notes'), b: { 'module.f.mjs': file('export const x = 1') } },
            })
            const page = textOf(/** @type {Dir} */ (generated.root['a'])['index.html'], 'the page')
            assert(page.includes('>notes.md</a>'), page)
            assert(page.includes('<summary>Directories</summary>'), page)
        },
        /**
         * **`todo/` is a section of its parent, not a page.** Its issues are
         * the parent's open work, and a page of its own would hold nothing
         * else — so it is neither generated nor linked, and no link to a
         * missing page can exist.
         */
        todoIsTheParentsSection: () => {
            const [generated] = run({
                a: {
                    'module.f.mjs': file('export const x = 1'),
                    todo: { 'open.md': file('## open') },
                },
            })
            const dir = /** @type {Dir} */ (generated.root['a'])
            const page = textOf(dir['index.html'], 'the page')
            assert(page.includes('<a href="/a/todo/open.md">open.md</a>'), page)
            assert(!page.includes('>todo/</a>'), page)
            assert(!('index.html' in /** @type {Dir} */ (dir['todo'])), 'expected no page for todo/')
        },
        /**
         * **An issue is a markdown file.** A `todo/` may hold something else
         * — the repository root's holds `proof.f.mjs`, an authored module the
         * suite runs — and listing it as an issue said it was one.
         */
        issuesAreMarkdown: () => {
            const [generated] = run({
                a: {
                    'module.f.mjs': file('export const x = 1'),
                    todo: { 'open.md': file('## open'), 'proof.f.mjs': file('export const proof = []') },
                },
            })
            const page = textOf(/** @type {Dir} */ (generated.root['a'])['index.html'], 'the page')
            assert(page.includes('>open.md</a>'), page)
            assert(!page.includes('>proof.f.mjs</a>'), page)
        },
        /**
         * **A folder inside a `todo/` is skipped too.** Excluding only the
         * directory whose own name is `todo` gave its subdirectories pages,
         * and `ancestors` put `todo` in each breadcrumb — a link to the one
         * page the generator never writes. What makes an issue folder's
         * contents its parent's business does not stop applying one level
         * down.
         */
        todoSubdirectoriesAreSkippedToo: () => {
            const [generated] = run({
                todo: {
                    'open.md': file('## open'),
                    plan: { 'later.md': file('## later'), deep: { 'x.md': file('## x') } },
                },
            })
            const todo = /** @type {Dir} */ (generated.root['todo'])
            const plan = /** @type {Dir} */ (todo['plan'])
            assert(!('index.html' in todo), 'expected no page for todo/')
            assert(!('index.html' in plan), 'expected no page for todo/plan/')
            assert(!('index.html' in /** @type {Dir} */ (plan['deep'])),
                'expected no page for todo/plan/deep/')
        },
        // The breadcrumb walks back to the root through pages that exist.
        breadcrumbReachesTheRoot: () => {
            const [generated] = run({ a: { b: { 'module.f.mjs': file('export const x = 1') } } })
            const page = textOf(
                /** @type {Dir} */ (/** @type {Dir} */ (generated.root['a'])['b'])['index.html'],
                'the page')
            assert(page.includes('<a href="/index.html">root</a>'), page)
            assert(page.includes('<a href="/a/index.html">a</a>'), page)
        },
        // An ignored directory is not walked, so it gets no page either.
        ignoredDirectoriesGetNoPage: () => {
            const [generated] = run({ node_modules: { a: { 'module.f.mjs': file('export const x = 1') } } })
            assert(
                !('index.html' in /** @type {Dir} */ (generated.root['node_modules'])),
                'expected no page inside node_modules')
        },
        /**
         * **A page runs the proofs of its own subtree**, named as `fjs t`
         * names them from that directory — one test, one name, however it is
         * reached.
         */
        aPageRunsItsSubtree: () => {
            const { root } = generate({
                a: {
                    'proof.f.mjs': file('export const proof = []'),
                    b: { 'proof.f.mjs': file('export const proof = []') },
                },
                c: { 'proof.f.mjs': file('export const proof = []') },
            })
            // Path order, which the page's slice keeps: `a/b/proof.f.mjs`
            // sorts before `a/proof.f.mjs`, on the root page and on `a`'s.
            assertStructurallySame(listed(pageAt(root, [])),
                ['a/b/proof.f.mjs', 'a/proof.f.mjs', 'c/proof.f.mjs'])
            assertStructurallySame(listed(pageAt(root, ['a'])),
                ['b/proof.f.mjs', 'proof.f.mjs'])
            assertStructurallySame(listed(pageAt(root, ['a', 'b'])), ['proof.f.mjs'])
        },
        // A directory that proves nothing has no suite section, so no button
        // promises a run that would do nothing.
        aDirectoryWithoutProofsHasNoSection: () => {
            const { root } = generate({ a: { 'notes.md': file('# notes') } })
            const page = pageAt(root, ['a'])
            assert(!page.includes('<summary>Emergent Testing</summary>'), page)
            assert(!page.includes('data-test-run'), page)
        },
        /**
         * **A proof a browser cannot link is named on its page with the
         * blocker**, and left out of what the page loads: an empty list would
         * leave "nothing here" and "nothing that runs here" indistinguishable.
         */
        aBlockedProofIsNamedNotHidden: () => {
            const { root } = generate({
                a: { 'proof.f.mjs': file("import 'node:fs'\nexport const proof = []") },
            })
            const page = pageAt(root, ['a'])
            assert(page.includes('./proof.f.mjs — not linkable in a browser: node:fs'), page)
            assertStructurallySame(listed(page), [])
            // Nothing here can run, so nothing offers to run it: a run over an
            // empty source list would report a green verdict for a subtree
            // where nothing ran.
            assert(!page.includes('data-test-run'), page)
            assert(!page.includes('<script'), page)
        },
    },
    run: () => {
        /** @type {Dir} */
        const root = { '.github': { workflows: {} }, fjs: { website: { 'browser.mjs': file('export const proof = {}') } } }
        const state = { ...emptyState, root }
        const [generated, result] = virtual(state)(main())
        assertEq(exitCode(result), 0)
        const source = pageAt(generated.root, [])
        assert(source.includes('emergent-testing-in-javascript-e44760d71688'))
        assert(!source.includes('?sk='))
        // The page starts idle, not mid-run, and its only control is the
        // renamed `Run` — never the old `Run again` label.
        assert(source.includes('data-state="idle"'), source)
        assert(source.includes('>Run</button>'), source)
        assert(!source.includes('Run again'), source)
        assert(source.includes('<summary>Directories</summary>'), source)
        // The catalogue is above the suite: what the directory holds is what
        // the reader came for, and a run cannot move what is above it.
        assert(
            source.indexOf('<summary>Directories</summary>')
                < source.indexOf('<summary>Emergent Testing</summary>'),
            source)
        // The heading is the project; the suite is one section of its page.
        assert(source.includes('<h1>FunctionalScript</h1>'), source)
        // The report is what it always was; only the section around it folds.
        assert(source.includes('<pre><ol data-test-results=""></ol></pre>'), source)
        /**
         * **The page runs its own proofs and starts nothing on load.** The
         * runner is imported by an absolute path, so a page at any depth
         * reaches the same module, and bound to the button rather than called.
         */
        assert(source.includes("import { startBrowserTestSources } from '/fjs/emergent_testing/browser/module.mjs'"), source)
        assert(source.includes("addEventListener("), source)
        assertStructurallySame(listed(source), ['fjs/website/browser.mjs'])
    },
}
