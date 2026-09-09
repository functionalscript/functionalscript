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
 * discovery into FunctionalScript bought: a directory of fixtures in, a
 * manifest out, no filesystem touched.
 *
 * @type {(tree: Dir) => readonly [State, number]}
 */
const run = tree => {
    // The manifest is written beside the runner that loads it, so the fixture
    // carries that directory: the generator writes a file, it does not create
    // the tree the repository already has.
    /** @type {Dir} */
    const root = {
        ...tree,
        fjs: { emergent_testing: {}, .../** @type {Dir} */ (tree['fjs'] ?? {}) },
    }
    const [generated, result] = virtual({ ...emptyState, root })(main())
    return [generated, exitCode(result)]
}

/**
 * The manifest a successful run wrote, and what it said while writing it.
 *
 * @type {(tree: Dir) => { readonly manifest: string, readonly output: string }}
 */
const generate = tree => {
    const [generated, code] = run(tree)
    assertEq(code, 0)
    return {
        manifest: textOf(
            /** @type {Dir} */ (/** @type {Dir} */ (generated.root['fjs'])?.['emergent_testing'])
                ?.['_browser-suite.mjs'],
            'the manifest'),
        output: generated.stdout,
    }
}

/**
 * The sources a manifest lists, in its own order.
 *
 * @type {(manifest: string) => readonly string[]} */
const listed = manifest => manifest
    .split('\n')
    .flatMap(line => line.startsWith("    './") ? [line.slice(7, -2)] : [])

export const proof = {
    main: () => {
        assertNotNullish(main(), 'expected a program effect')
    },
    manifest: {
        // Every `.f.mjs` that exports a `proof` and imports nothing a browser
        // cannot resolve, in path order — and nothing else in the tree.
        selectsProofModules: () => {
            const { manifest, output } = generate({
                a: {
                    'module.f.mjs': file('export const x = 1'),
                    'proof.f.mjs': file("export const proof = { t: () => {} }"),
                },
                'b.f.mjs': file('export const proof = []'),
                'c.mjs': file('export const proof = []'),
            })
            assertStructurallySame(listed(manifest), ['a/proof.f.mjs', 'b.f.mjs'])
            assert(output.includes('browser proof modules: 2 of 2'), output)
        },
        // A module a browser cannot link is dropped rather than emitted, with
        // the reason said out loud: emitting it would fail the page *while it
        // links*, before the runner can publish a report.
        dropsWhatABrowserCannotLink: () => {
            const { manifest, output } = generate({
                'a.f.mjs': file("import 'node:fs'\nexport const proof = []"),
                'b.f.mjs': file("import 'left-pad'\nexport const proof = []"),
            })
            assertStructurallySame(listed(manifest), [])
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
            const { manifest } = generate({
                'a.f.mjs': file("import './dep.f.mjs'\nexport const proof = []"),
                'dep.f.mjs': file("import 'node:fs'\nexport const x = 1"),
            })
            assertStructurallySame(listed(manifest), [])
        },
        // An import cycle terminates: a module already read is not read again,
        // which is the same skip that keeps one module read once however many
        // others import it.
        importCycleTerminates: () => {
            const { manifest } = generate({
                'a.f.mjs': file("import './b.f.mjs'\nexport const proof = []"),
                'b.f.mjs': file("import './a.f.mjs'\nexport const x = 1"),
            })
            assertStructurallySame(listed(manifest), ['a.f.mjs'])
        },
        /**
         * **A relative specifier naming no file is not a blocker.** The scan is
         * textual, so a module that emits source of its own — the website
         * generator embeds the page's entry module — offers up import lines
         * that were never its own. Nothing can be read at that path, and
         * nothing is what it contributes.
         */
        aSpecifierNamingNoFileIsDropped: () => {
            const { manifest } = generate({
                'a.f.mjs': file("import './gone.f.mjs'\nexport const proof = []"),
            })
            assertStructurallySame(listed(manifest), ['a.f.mjs'])
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
        // Where the sources are is the tree's business: a nested directory is
        // walked, and its path is what the manifest carries.
        walksNestedDirectories: () => {
            const { manifest } = generate({
                fjs: { types: { list: { 'proof.f.mjs': file('export const proof = []') } } },
            })
            assertStructurallySame(listed(manifest), ['fjs/types/list/proof.f.mjs'])
        },
        /**
         * **Three directories are not this repository's source**, and the test
         * is by segment rather than by prefix — so a `node_modules` nested
         * anywhere is ignored too, which is exactly where one is found.
         */
        ignoresForeignDirectories: () => {
            const { manifest } = generate({
                node_modules: { 'a.f.mjs': file('export const proof = []') },
                target: { 'b.f.mjs': file('export const proof = []') },
                '.git': { 'c.f.mjs': file('export const proof = []') },
                fjs: {
                    node_modules: { 'd.f.mjs': file('export const proof = []') },
                    'e.f.mjs': file('export const proof = []'),
                },
            })
            assertStructurallySame(listed(manifest), ['fjs/e.f.mjs'])
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
        // A directory that only groups others lists no files at all — there is
        // nothing in it a reader would open.
        aGroupingDirectoryListsNoFiles: () => {
            const [generated] = run({ a: { b: { 'module.f.mjs': file('export const x = 1') } } })
            const page = textOf(/** @type {Dir} */ (generated.root['a'])['index.html'], 'the page')
            assert(!page.includes('<h2>Files</h2>'), page)
            assert(page.includes('<h2>Directories</h2>'), page)
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
    },
    run: () => {
        /** @type {Dir} */
        const root = { '.github': { workflows: {} }, fjs: { emergent_testing: {} } }
        const state = { ...emptyState, root }
        const [generated, result] = virtual(state)(main())
        assertEq(exitCode(result), 0)
        const page = assertNotNullish(generated.root['index.html'], 'expected generated HTML')
        const entryFile = assertNotNullish(generated.root['_browser-test-entry.mjs'],
            'expected generated entry module')
        assert(Array.isArray(page), 'expected the generated HTML to be a file')
        assert(Array.isArray(entryFile), 'expected the generated entry module to be a file')
        const source = page.map(value => utf8ToString(/** @type {Vec} */ (value))).join('')
        const entry = entryFile.map(value => utf8ToString(/** @type {Vec} */ (value))).join('')
        assert(source.includes('<h1>Emergent Testing in the Browser</h1>'))
        assert(source.includes('emergent-testing-in-javascript-e44760d71688'))
        assert(!source.includes('?sk='))
        // The page starts idle, not mid-run, and its only control is the
        // renamed `Run` — never the old `Run again` label.
        assert(source.includes('data-state="idle"'), source)
        // The root page is the root directory's page too: it carries the same
        // catalogue every other page does.
        assert(source.includes('<h2>Directories</h2>'), source)
        // The result rows are behind a closed disclosure, so a run costs the
        // page one line and the catalogue below it does not move.
        assert(source.includes('<details data-test-report=""><summary>Results</summary>'), source)
        assert(source.includes('<ol data-test-results="">'), source)
        assert(source.includes('>Run</button>'), source)
        assert(!source.includes('Run again'), source)
        // The entry module wires the click handler and stops: it must not
        // call `start()` on its own, whether unconditionally or behind a
        // `run` query parameter.
        assert(!entry.includes('searchParams'), entry)
        assert(entry.trim().endsWith("runButton.addEventListener('click', start)"), entry)
        // The stylesheet is one file at the root, linked root-relative so a
        // module page at any depth reaches the same one, and the page carries
        // no inline copy that could drift from it.
        assertEq(textOf(generated.root['_main.css'], 'the stylesheet'), stylesheet)
        assert(source.includes('<link rel="stylesheet" href="/_main.css">'), source)
        assert(!source.includes('<style>'), source)
    },
}
