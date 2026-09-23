/**
 * @import { Dir } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { element } from '../../media/html/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { utf8ToString } from '../../text/module.f.mjs'
import { demoSection, page, pageHref, repository, sections, subtree, testSection } from './module.f.mjs'

/** @type {(dir: Dir) => string} */
const sectionsHtml = dir => concat(element(['body', ...sections(null)(dir)]))

/** @type {(dir: Dir) => string} */
const pageHtml = dir => utf8ToString(page(null)(dir))

/** A commit id in the shape the generator hands the builder: 40 lowercase hex. */
const commit = '0123456789abcdef0123456789abcdef01234567'

/** @type {(dir: Dir) => string} */
const sectionsAtCommit = dir => concat(element(['body', ...sections(commit)(dir)]))

/** @type {Dir} */
const empty = { path: '.', files: [], dirs: [], todo: [], proofs: [], demo: null }

export const proof = {
    pageHref: {
        // The root has no segments, so its page is `/index.html` and not
        // `/./index.html`.
        root: () => assertEq(pageHref('.'), '/index.html'),
        nested: () => assertEq(pageHref('fjs/types/list'), '/fjs/types/list/index.html'),
        /**
         * **A directory name is encoded, segment by segment.** A space would
         * be sent as-is, and a `#` would turn the rest of the path into a
         * fragment; the `/` between segments is the one character that stays.
         */
        encoded: () => assertEq(pageHref('fjs/x y#1/中'), '/fjs/x%20y%231/%E4%B8%AD/index.html'),
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
            + '<ul data-links=""><li><a href="/fjs/types/list/module.f.mjs">module.f.mjs</a></li></ul></details></body>'),
        // A file of the root directory has no directory in its path.
        filesAtRoot: () => assertEq(
            sectionsHtml({ ...empty, files: ['module.f.mjs'] }),
            '<body><details data-section="" open=""><summary>Files</summary>'
            + '<ul data-links=""><li><a href="/module.f.mjs">module.f.mjs</a></li></ul></details></body>'),
        /**
         * **Directories and files open, issues closed.** The first two are
         * bounded by the directory; the issue list is not, and an open one
         * would push the proofs below it off the screen.
         */
        issuesStartClosed: () => {
            const html = sectionsHtml({ ...empty, path: 'fjs', todo: ['a.md'], dirs: ['types'] })
            assert(html.includes('<details data-section=""><summary>Issues</summary>'), html)
            assert(html.includes('<details data-section="" open=""><summary>Directories</summary>'), html)
        },
        /**
         * **Directories come before files**, as GitHub and a file manager
         * list them: the way deeper is what the page leads with.
         */
        dirsBeforeFiles: () => assertEq(
            sectionsHtml({ ...empty, path: 'fjs', dirs: ['types'], files: ['module.f.mjs'] }),
            '<body><details data-section="" open=""><summary>Directories</summary>'
            + '<ul data-links=""><li><a href="/fjs/types/index.html">types/</a></li></ul></details>'
            + '<details data-section="" open=""><summary>Files</summary>'
            + '<ul data-links=""><li><a href="/fjs/module.f.mjs">module.f.mjs</a></li></ul></details></body>'),
        // A subdirectory link points at a page, and every such page exists —
        // which is what the "every directory gets one" rule buys.
        dirs: () => assertEq(
            sectionsHtml({ ...empty, path: 'fjs', dirs: ['types'] }),
            '<body><details data-section="" open=""><summary>Directories</summary>'
            + '<ul data-links=""><li><a href="/fjs/types/index.html">types/</a></li></ul></details></body>'),
        dirsAtRoot: () => assertEq(
            sectionsHtml({ ...empty, dirs: ['fjs'] }),
            '<body><details data-section="" open=""><summary>Directories</summary>'
            + '<ul data-links=""><li><a href="/fjs/index.html">fjs/</a></li></ul></details></body>'),
        // An issue is linked inside the `todo/` it was filed in, which has no
        // page of its own.
        todo: () => assertEq(
            sectionsHtml({ ...empty, path: 'fjs', todo: ['a.md'] }),
            '<body><details data-section=""><summary>Issues</summary>'
            + '<ul data-links=""><li><a href="/fjs/todo/a.md">a.md</a></li></ul></details></body>'),
        todoAtRoot: () => assertEq(
            sectionsHtml({ ...empty, todo: ['a.md'] }),
            '<body><details data-section=""><summary>Issues</summary>'
            + '<ul data-links=""><li><a href="/todo/a.md">a.md</a></li></ul></details></body>'),
        /**
         * **A file name that is not already a URL is encoded**, on this site
         * and on GitHub alike. `%` is in it on purpose: an encoder that
         * skipped it would leave `100%` reading as the start of an escape.
         */
        encoded: {
            files: () => assertEq(
                sectionsHtml({ ...empty, path: 'fjs/x y', files: ['a b#c?100%.md'] }),
                '<body><details data-section="" open=""><summary>Files</summary>'
                + '<ul data-links=""><li><a href="/fjs/x%20y/a%20b%23c%3F100%25.md">a b#c?100%.md</a></li></ul></details></body>'),
            todo: () => assertEq(
                sectionsHtml({ ...empty, path: 'fjs', todo: ['open issue.md'] }),
                '<body><details data-section=""><summary>Issues</summary>'
                + '<ul data-links=""><li><a href="/fjs/todo/open%20issue.md">open issue.md</a></li></ul></details></body>'),
            dirs: () => assertEq(
                sectionsHtml({ ...empty, path: 'fjs', dirs: ['x y'] }),
                '<body><details data-section="" open=""><summary>Directories</summary>'
                + '<ul data-links=""><li><a href="/fjs/x%20y/index.html">x y/</a></li></ul></details></body>'),
            atCommit: () => assertEq(
                sectionsAtCommit({ ...empty, path: 'fjs/x y', files: ['中.md'] }),
                '<body><details data-section="" open=""><summary>Files</summary>'
                + `<ul data-links=""><li><a href="${repository}/blob/${commit}/fjs/x%20y/%E4%B8%AD.md">中.md</a></li></ul></details></body>`),
        },
        /**
         * **With a commit, a file a reader opens is read on GitHub**, at that
         * commit — highlighted, and Markdown rendered — which the raw link on
         * this site is neither.
         */
        atCommit: {
            files: () => assertEq(
                sectionsAtCommit({ ...empty, path: 'fjs/types/list', files: ['module.f.mjs'] }),
                '<body><details data-section="" open=""><summary>Files</summary>'
                + `<ul data-links=""><li><a href="${repository}/blob/${commit}/fjs/types/list/module.f.mjs">module.f.mjs</a></li></ul></details></body>`),
            filesAtRoot: () => assertEq(
                sectionsAtCommit({ ...empty, files: ['README.md'] }),
                '<body><details data-section="" open=""><summary>Files</summary>'
                + `<ul data-links=""><li><a href="${repository}/blob/${commit}/README.md">README.md</a></li></ul></details></body>`),
            todo: () => assertEq(
                sectionsAtCommit({ ...empty, path: 'fjs', todo: ['a.md'] }),
                '<body><details data-section=""><summary>Issues</summary>'
                + `<ul data-links=""><li><a href="${repository}/blob/${commit}/fjs/todo/a.md">a.md</a></li></ul></details></body>`),
            // A directory is one of this site's pages, which GitHub does not
            // have, so its link does not move.
            dirsStayHere: () => assertEq(
                sectionsAtCommit({ ...empty, path: 'fjs', dirs: ['types'] }),
                '<body><details data-section="" open=""><summary>Directories</summary>'
                + '<ul data-links=""><li><a href="/fjs/types/index.html">types/</a></li></ul></details></body>'),
        },
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
            // The title carries a slot the runner fills with the run's counts.
            assert(html.includes('<summary>Emergent Testing<span data-test-counts=""></span></summary>'), html)
            // A runnable entry names its source, so a run can mark it if it
            // reports no tests.
            assert(html.includes('<li data-source="./proof.f.mjs">./proof.f.mjs</li>'), html)
            assert(html.includes('data-test-run'), html)
            assert(html.includes('<div data-test-results="">'), html)
            // **The sources list follows the report.** The stylesheet hides it
            // with a sibling selector once the report has content, and a
            // sibling selector only looks forward — put the list first and it
            // would never hide.
            const results = html.indexOf('<div data-test-results="">')
            const sources = html.indexOf('<ul data-test-sources="">')
            assert(sources !== -1 && results < sources, html)
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
            // **Only the blocked entry is marked.** The stylesheet hides the
            // unmarked ones once a run has results, and keeps the marked one:
            // it is the entry no group in the report will ever stand for.
            assert(html.includes('<li data-blocked="">./a.f.mjs — not linkable in a browser: node:fs</li>'), html)
            assert(html.includes('<li data-source="./b.f.mjs">./b.f.mjs</li>'), html)
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
        // The page names its language, names itself in the tab, and links the
        // stylesheet and the favicon.
        head: () => {
            const html = pageHtml({ ...empty, path: 'fjs' })
            assert(html.includes('<html lang="en">'), html)
            assert(html.includes('<title>fjs</title>'), html)
            assert(html.includes('<link rel="stylesheet" href="/_main.css">'), html)
            assert(html.includes('<link rel="icon" href="/favicon.ico" sizes="32x32">'), html)
            assert(html.includes('<link rel="icon" type="image/svg+xml" href="/fjs/website/favicon.svg">'), html)
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
                + '<ul data-links=""><li><a href="/fjs/types/index.html">types/</a></li></ul></details>'),
                pageHtml(dir))
        },
    },
}
