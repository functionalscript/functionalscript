/**
 * @import { Dir } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { element } from '../../media/html/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { utf8ToString } from '../../text/module.f.mjs'
import { demoSection, page, pageHref, sections, subtree, testSection } from './module.f.mjs'

/** @type {(dir: Dir) => string} */
const sectionsHtml = dir => concat(element(['body', ...sections(dir)]))

/** @type {(dir: Dir) => string} */
const pageHtml = dir => utf8ToString(page(dir))

/** @type {Dir} */
const empty = { path: '.', files: [], dirs: [], todo: [], proofs: [], demo: null }

export const proof = {
    pageHref: {
        // The root has no segments, so its page is `/index.html` and not
        // `/./index.html`.
        root: () => assertEq(pageHref('.'), '/index.html'),
        nested: () => assertEq(pageHref('fjs/types/list'), '/fjs/types/list/index.html'),
    },
    sections: {
        // A directory with nothing in it says nothing: no heading stands over
        // an empty list.
        allEmpty: () => assertEq(sectionsHtml(empty), '<body></body>'),
        // A file is linked at its own repository path, root-relative, so the
        // same href is written wherever the page sits.
        files: () => assertEq(
            sectionsHtml({ ...empty, path: 'fjs/types/list', files: ['module.f.mjs'] }),
            '<body><details data-section="" open=""><summary>Files</summary>'
            + '<ul><li><a href="/fjs/types/list/module.f.mjs">module.f.mjs</a></li></ul></details></body>'),
        // A file of the root directory has no directory in its path.
        filesAtRoot: () => assertEq(
            sectionsHtml({ ...empty, files: ['module.f.mjs'] }),
            '<body><details data-section="" open=""><summary>Files</summary>'
            + '<ul><li><a href="/module.f.mjs">module.f.mjs</a></li></ul></details></body>'),
        /**
         * **Files and directories open, issues closed.** The first two are
         * bounded by the directory; the issue list is not, and an open one
         * would push the proofs below it off the screen.
         */
        issuesStartClosed: () => {
            const html = sectionsHtml({ ...empty, path: 'fjs', todo: ['a.md'], dirs: ['types'] })
            assert(html.includes('<details data-section=""><summary>Issues</summary>'), html)
            assert(html.includes('<details data-section="" open=""><summary>Directories</summary>'), html)
        },
        // A subdirectory link points at a page, and every such page exists —
        // which is what the "every directory gets one" rule buys.
        dirs: () => assertEq(
            sectionsHtml({ ...empty, path: 'fjs', dirs: ['types'] }),
            '<body><details data-section="" open=""><summary>Directories</summary>'
            + '<ul><li><a href="/fjs/types/index.html">types/</a></li></ul></details></body>'),
        dirsAtRoot: () => assertEq(
            sectionsHtml({ ...empty, dirs: ['fjs'] }),
            '<body><details data-section="" open=""><summary>Directories</summary>'
            + '<ul><li><a href="/fjs/index.html">fjs/</a></li></ul></details></body>'),
        // An issue is linked inside the `todo/` it was filed in, which has no
        // page of its own.
        todo: () => assertEq(
            sectionsHtml({ ...empty, path: 'fjs', todo: ['a.md'] }),
            '<body><details data-section=""><summary>Issues</summary>'
            + '<ul><li><a href="/fjs/todo/a.md">a.md</a></li></ul></details></body>'),
        todoAtRoot: () => assertEq(
            sectionsHtml({ ...empty, todo: ['a.md'] }),
            '<body><details data-section=""><summary>Issues</summary>'
            + '<ul><li><a href="/todo/a.md">a.md</a></li></ul></details></body>'),
    },
    subtree: {
        /**
         * **The name is page-relative**, so a proof is called what `fjs t`
         * calls it when run from the page's own directory.
         */
        rebasesToThePage: () => assertStructurallySame(
            subtree('fjs/types/list')([{ name: 'fjs/types/list/proof.f.mjs', blockers: [] }]),
            [{ name: './proof.f.mjs', blockers: [] }]),
        // At the root the prefix is empty, so a name keeps its whole path.
        rootKeepsThePath: () => assertStructurallySame(
            subtree('.')([{ name: 'fjs/a/proof.f.mjs', blockers: [] }]),
            [{ name: './fjs/a/proof.f.mjs', blockers: [] }]),
        // The whole subtree, not the directory's own proof alone.
        takesTheWholeSubtree: () => assertStructurallySame(
            subtree('fjs')([
                { name: 'fjs/proof.f.mjs', blockers: [] },
                { name: 'fjs/a/b/proof.f.mjs', blockers: [] },
            ]),
            [
                { name: './proof.f.mjs', blockers: [] },
                { name: './a/b/proof.f.mjs', blockers: [] },
            ]),
        /**
         * **The test is on the separator.** Without it `fjs/types` would
         * claim `fjs/types_old/`, a different directory whose page exists in
         * its own right.
         */
        aLongerNameIsNotASubtree: () => assertStructurallySame(
            subtree('fjs/types')([{ name: 'fjs/types_old/proof.f.mjs', blockers: [] }]),
            []),
        // A blocker travels with the proof it belongs to.
        keepsBlockers: () => assertStructurallySame(
            subtree('a')([{ name: 'a/proof.f.mjs', blockers: ['node:fs'] }]),
            [{ name: './proof.f.mjs', blockers: ['node:fs'] }]),
    },
    testSection: {
        // A directory that proves nothing gets no section: a `Run` button
        // over nothing is a control that lies about what it will do.
        omittedWithoutProofs: () =>
            assertStructurallySame(testSection(empty)([]), []),
        // The control, the report and the list the run reports against.
        namesItsProofsAndBindsRun: () => {
            const html = concat(element(['body', ...testSection(
                { ...empty, proofs: [{ name: './proof.f.mjs', blockers: [] }] })([])]))
            assert(html.includes('<summary>Emergent Testing</summary>'), html)
            assert(html.includes('<li>./proof.f.mjs</li>'), html)
            assert(html.includes('data-test-run'), html)
            assert(html.includes('<ol data-test-results="">'), html)
            assert(html.includes("'./proof.f.mjs',"), html)
        },
        /**
         * **A proof a browser cannot link is named with its blocker**, and
         * kept out of the sources: an empty list would leave "nothing here"
         * and "nothing that runs here" indistinguishable. Its neighbour still
         * runs, so the control is still there.
         */
        namesWhatCannotRun: () => {
            const html = concat(element(['body', ...testSection({ ...empty, proofs: [
                { name: './a.f.mjs', blockers: ['node:fs'] },
                { name: './b.f.mjs', blockers: [] },
            ] })([])]))
            assert(html.includes('./a.f.mjs — not linkable in a browser: node:fs'), html)
            assert(!html.includes("'./a.f.mjs',"), html)
            assert(html.includes("'./b.f.mjs',"), html)
            assert(html.includes('data-test-run'), html)
        },
        /**
         * **No control where nothing can run.** A subtree whose proofs are all
         * blocked keeps its section and its reasons and loses the button: a
         * run over an empty source list loads nothing, finds no failures, and
         * is reported `passed` — a green verdict for a subtree where nothing
         * ran at all.
         */
        noRunWhereNothingLinks: () => {
            const html = concat(element(['body', ...testSection(
                { ...empty, proofs: [{ name: './a.f.mjs', blockers: ['node:fs'] }] })([])]))
            assert(html.includes('<summary>Emergent Testing</summary>'), html)
            assert(html.includes('./a.f.mjs — not linkable in a browser: node:fs'), html)
            assert(!html.includes('data-test-run'), html)
            assert(!html.includes('data-test-results'), html)
            assert(!html.includes('<script'), html)
        },
        // Nothing starts on load; the runner is bound to the button.
        startsOnlyOnRun: () => {
            const html = concat(element(['body', ...testSection(
                { ...empty, proofs: [{ name: './proof.f.mjs', blockers: [] }] })([])]))
            assert(html.includes("addEventListener(\n    'click',"), html)
            assert(!html.includes('startBrowserTestSources(root, sources)\n'), html)
        },
        // The root page hands in the prose that introduces the suite.
        carriesAnIntro: () => {
            const html = concat(element(['body', ...testSection(
                { ...empty, proofs: [{ name: './p.f.mjs', blockers: [] }] })([['p', 'why']])]))
            assert(html.includes('<p>why</p>'), html)
        },
    },
    demoSection: {
        // The section is the demo's own root — the runtime replaces its
        // contents on every state — and the script names the module rather
        // than letting the runtime guess a filename.
        namesTheModuleAndStartsIt: () => {
            const html = concat(element(['body', ...demoSection('/a/demo.f.mjs')]))
            assert(html.includes('<summary>Demo</summary>'), html)
            assert(html.includes('<div data-demo="/a/demo.f.mjs">'), html)
            assert(html.includes("import { startDemo } from '/fjs/website/demo-runtime.mjs'"), html)
        },
    },
    page: {
        /**
         * The breadcrumb names every ancestor and stops before the directory
         * itself: a page does not link to the page it is.
         */
        breadcrumb: () => {
            const html = pageHtml({ ...empty, path: 'fjs/types/list' })
            assert(html.includes(
                '<nav><a href="/index.html">root</a> / <a href="/fjs/index.html">fjs</a>'
                + ' / <a href="/fjs/types/index.html">types</a></nav>'), html)
            assert(html.includes('<h1>fjs/types/list</h1>'), html)
            assert(!html.includes('list/index.html'), html)
        },
        // One directory below the root has the root as its only ancestor.
        breadcrumbOneDeep: () => {
            const html = pageHtml({ ...empty, path: 'fjs' })
            assert(html.includes('<nav><a href="/index.html">root</a></nav>'), html)
        },
        // The page names itself in the tab and links the one stylesheet.
        head: () => {
            const html = pageHtml({ ...empty, path: 'fjs' })
            assert(html.includes('<title>fjs</title>'), html)
            assert(html.includes('<link rel="stylesheet" href="/_main.css">'), html)
        },
        // A page with a demo carries it between the catalogue and the suite.
        carriesADemo: () => {
            const html = pageHtml({ ...empty, path: 'a', demo: '/a/demo.f.mjs' })
            assert(html.includes('data-demo="/a/demo.f.mjs"'), html)
        },
        // The catalogue is the same one the root page carries.
        carriesSections: () => {
            const dir = { ...empty, path: 'fjs', dirs: ['types'] }
            assert(pageHtml(dir).includes(
                '<details data-section="" open=""><summary>Directories</summary>'
                + '<ul><li><a href="/fjs/types/index.html">types/</a></li></ul></details>'),
                pageHtml(dir))
        },
    },
}
