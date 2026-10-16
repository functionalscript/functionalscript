/**
 * @import { Build, Dir } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { element } from '../../media/html/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { demoSection, directoryLayout, footer, header, page, pageHref, pagePath, repository, sections, subtree, testSection } from './module.f.mjs'

/** @type {(dir: Dir) => string} */
const sectionsHtml = dir => concat(element(['body', ...sections(null)(dir)]))

/** A build that names neither its commit nor its branch: a local one. @type {Build} */
const local = { commit: null, branch: null, funding: [] }

/** @type {(dir: Dir) => string} */
const pageHtml = dir => page(local)(dir)

/** A commit id in the shape the generator hands the builder: 40 lowercase hex. */
const commit = '0123456789abcdef0123456789abcdef01234567'

/** @type {(build: Build) => string} */
const headerHtml = build => concat(element(header(build)))

/** @type {(dir: Dir) => string} */
const sectionsAtCommit = dir => concat(element(['body', ...sections(commit)(dir)]))

/**
 * The Contents section around `items`, open, as the body it is the whole of.
 *
 * @type {(items: string) => string}
 */
const contents = items => '<body><details data-section="" open=""><summary><h2>Contents</h2></summary>'
    + `<ul data-links="">${items}</ul></details></body>`

/**
 * The Issues section around `items`, open, as the body it is the whole of.
 *
 * @type {(items: string) => string}
 */
const issues = items => '<body><details data-section="" open=""><summary><h2>Issues</h2></summary>'
    + `<ul data-links="">${items}</ul></details></body>`

/** @type {Dir} */
const empty = { path: '.', files: [], dirs: [], demoDirs: [], todo: [], proofs: [], demo: null, api: null, apiIndex: null }

export const proof = {
    /**
     * **Every page closes with the funding links**, separated by text so they
     * read as a list without the stylesheet, each marked as leaving the site.
     */
    footer: {
        links: () => assertEq(concat(element(['body', ...footer([
            { description: 'GitHub Sponsors', address: 'https://github.com/sponsors/x' },
            { description: 'Patreon', address: 'https://patreon.com/x' },
        ])])),
            '<body><footer data-funding="">Support FunctionalScript: '
            + '<a href="https://github.com/sponsors/x">GitHub Sponsors<span aria-hidden="true"> ↗</span></a>'
            + '\u00a0· '
            + '<a href="https://patreon.com/x">Patreon<span aria-hidden="true"> ↗</span></a>'
            + '</footer></body>'),
        // No channels, no footer: a heading for an empty list says nothing.
        none: () => assertStructurallySame(footer([]), []),
        // The footer is the frame's, so a directory's page carries it.
        onEveryPage: () => {
            const html = page({ ...local, funding: [{ description: 'Patreon', address: 'https://patreon.com/x' }] })(empty)
            assert(html.endsWith('</main></div><footer data-funding="">Support FunctionalScript: <a href="https://patreon.com/x">Patreon<span aria-hidden="true"> ↗</span></a></footer></body></html>'), html)
        },
    },
    /**
     * **Every page opens with the same header:** the logo and the name
     * linking home, the releases, and the repository.
     */
    header: {
        links: () => assertEq(headerHtml(local),
            '<header><nav aria-label="Site">'
            + '<a href="/index.html" data-home=""><img src="/fjs/website/favicon.svg" alt="" width="24" height="24">FunctionalScript</a>'
            + '<span data-site-links=""><a href="/cli/">CLI</a><a href="/prs/index.html">PRs</a><a href="/changelog/index.html">Releases</a>'
            + `<a href="${repository}">GitHub<span aria-hidden="true"> ↗</span></a></span>`
            + '</nav></header>'),
        /**
         * **A preview names its branch and its commit**, each linked on
         * GitHub, the commit shortened to what `git log --oneline` shows.
         */
        preview: () => {
            const html = headerHtml({ commit, branch: 'claude/x', funding: [] })
            assert(html.includes(
                '<p data-build="">Preview: '
                + `<a href="${repository}/tree/claude/x">claude/x</a>`
                + ` @ <a href="${repository}/commit/${commit}">0123456</a></p>`), html)
        },
        // A branch name is linked segment by segment, like a file: `/` is
        // kept, and a `#` does not start a fragment.
        branchIsEncoded: () => {
            const html = headerHtml({ commit: null, branch: 'a/b#c', funding: [] })
            assert(html.includes(`<a href="${repository}/tree/a/b%23c">a/b#c</a>`), html)
        },
        // A branch without a valid commit is still named; there is just no
        // commit to link.
        previewWithoutACommit: () => {
            const html = headerHtml({ commit: null, branch: 'x', funding: [] })
            assert(html.includes(`<a href="${repository}/tree/x">x</a></p>`), html)
            assert(!html.includes('/commit/'), html)
        },
        // The published site is `main`, and says nothing about its build.
        production: () => assert(!headerHtml({ commit, branch: 'main', funding: [] }).includes('data-build'), 'main'),
        // Nor does a local build, which names no branch.
        local: () => assert(!headerHtml({ commit, branch: null, funding: [] }).includes('data-build'), 'local'),
    },
    /**
     * **A page is written where its directory is**, and the root's at the
     * root itself rather than under `./`. Neither is encoded: a path to
     * write is not a URL.
     */
    pagePath: {
        root: () => assertEq(pagePath('.'), 'index.html'),
        nested: () => assertEq(pagePath('fjs/types/list'), 'fjs/types/list/index.html'),
        notEncoded: () => assertEq(pagePath('fjs/x y#1'), 'fjs/x y#1/index.html'),
    },
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
            contents('<li><a href="/fjs/types/list/module.f.mjs" data-kind="file">module.f.mjs</a></li>')),
        // A file of the root directory has no directory in its path.
        filesAtRoot: () => assertEq(
            sectionsHtml({ ...empty, files: ['module.f.mjs'] }),
            contents('<li><a href="/module.f.mjs" data-kind="file">module.f.mjs</a></li>')),
        /**
         * **Contents is one list: directories, then files**, each marked with
         * its kind. The way deeper leads.
         */
        contentsInOrder: () => assertEq(
            sectionsHtml({ ...empty, path: 'fjs', files: ['module.f.mjs'], dirs: ['types'] }),
            contents('<li><a href="/fjs/types/index.html" data-kind="dir">types</a></li>'
                + '<li><a href="/fjs/module.f.mjs" data-kind="file">module.f.mjs</a></li>')),
        /**
         * **Issues are a list of their own, after Contents and open.** Both
         * lists are available without opening a disclosure control.
         */
        issuesSeparateAndOpen: () => {
            const html = sectionsHtml({ ...empty, path: 'fjs', todo: ['a.md'], files: ['module.f.mjs'] })
            assertEq(html,
                '<body><details data-section="" open=""><summary><h2>Contents</h2></summary>'
                + '<ul data-links=""><li><a href="/fjs/module.f.mjs" data-kind="file">module.f.mjs</a></li></ul></details>'
                + '<details data-section="" open=""><summary><h2>Issues</h2></summary>'
                + '<ul data-links=""><li><a href="/fjs/todo/a.md" data-kind="issue">a.md</a></li></ul></details></body>')
        },
        // A subdirectory link points at a page, and every such page exists —
        // which is what the "every directory gets one" rule buys.
        dirs: () => assertEq(
            sectionsHtml({ ...empty, path: 'fjs', dirs: ['types'] }),
            contents('<li><a href="/fjs/types/index.html" data-kind="dir">types</a></li>')),
        dirsAtRoot: () => assertEq(
            sectionsHtml({ ...empty, dirs: ['fjs'] }),
            contents('<li><a href="/fjs/index.html" data-kind="dir">fjs</a></li>')),
        // A directory with a demo under it is marked; one without is not.
        dirsWithADemo: () => assertEq(
            sectionsHtml({ ...empty, dirs: ['a', 'b'], demoDirs: ['b'] }),
            contents('<li><a href="/a/index.html" data-kind="dir">a</a></li>'
                + '<li><a href="/b/index.html" data-kind="dir" data-has-demo="">b</a></li>')),
        // An issue is linked inside the `todo/` it was filed in, which has no
        // page of its own.
        todo: () => assertEq(
            sectionsHtml({ ...empty, path: 'fjs', todo: ['a.md'] }),
            issues('<li><a href="/fjs/todo/a.md" data-kind="issue">a.md</a></li>')),
        todoAtRoot: () => assertEq(
            sectionsHtml({ ...empty, todo: ['a.md'] }),
            issues('<li><a href="/todo/a.md" data-kind="issue">a.md</a></li>')),
        /**
         * **A file name that is not already a URL is encoded**, on this site
         * and on GitHub alike. `%` is in it on purpose: an encoder that
         * skipped it would leave `100%` reading as the start of an escape.
         */
        encoded: {
            files: () => assertEq(
                sectionsHtml({ ...empty, path: 'fjs/x y', files: ['a b#c?100%.md'] }),
                contents('<li><a href="/fjs/x%20y/a%20b%23c%3F100%25.md" data-kind="file">a b#c?100%.md</a></li>')),
            todo: () => assertEq(
                sectionsHtml({ ...empty, path: 'fjs', todo: ['open issue.md'] }),
                issues('<li><a href="/fjs/todo/open%20issue.md" data-kind="issue">open issue.md</a></li>')),
            dirs: () => assertEq(
                sectionsHtml({ ...empty, path: 'fjs', dirs: ['x y'] }),
                contents('<li><a href="/fjs/x%20y/index.html" data-kind="dir">x y</a></li>')),
            atCommit: () => assertEq(
                sectionsAtCommit({ ...empty, path: 'fjs/x y', files: ['中.md'] }),
                contents(`<li><a href="${repository}/blob/${commit}/fjs/x%20y/%E4%B8%AD.md" data-kind="file">中.md</a></li>`)),
        },
        /**
         * **With a commit, a file a reader opens is read on GitHub**, at that
         * commit — highlighted, and Markdown rendered — which the raw link on
         * this site is neither.
         */
        atCommit: {
            files: () => assertEq(
                sectionsAtCommit({ ...empty, path: 'fjs/types/list', files: ['module.f.mjs'] }),
                contents(`<li><a href="${repository}/blob/${commit}/fjs/types/list/module.f.mjs" data-kind="file">module.f.mjs</a></li>`)),
            filesAtRoot: () => assertEq(
                sectionsAtCommit({ ...empty, files: ['README.md'] }),
                contents(`<li><a href="${repository}/blob/${commit}/README.md" data-kind="file">README.md</a></li>`)),
            todo: () => assertEq(
                sectionsAtCommit({ ...empty, path: 'fjs', todo: ['a.md'] }),
                issues(`<li><a href="${repository}/blob/${commit}/fjs/todo/a.md" data-kind="issue">a.md</a></li>`)),
            // A directory is one of this site's pages, which GitHub does not
            // have, so its link does not move.
            dirsStayHere: () => assertEq(
                sectionsAtCommit({ ...empty, path: 'fjs', dirs: ['types'] }),
                contents('<li><a href="/fjs/types/index.html" data-kind="dir">types</a></li>')),
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
            // Folded: the suite is asked for, not what a reader came for.
            assert(html.startsWith('<body><details data-section=""><summary>'), html)
            // The title carries a slot the runner fills with the run's counts.
            assert(html.includes('<summary><h2>Emergent Testing</h2><span data-test-counts=""></span></summary>'), html)
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
            assert(html.includes('<summary><h2>Emergent Testing</h2></summary>'), html)
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
            const html = concat(element(['body', ...demoSection({ path: '/a/demo.f.mjs', view: null })]))
            assert(html.includes('<summary><h2>Demo</h2></summary>'), html)
            assert(html.includes('<div data-demo="/a/demo.f.mjs"></div>'), html)
            assert(html.includes("import { startDemo } from '/fjs/website/demo-runtime.mjs'"), html)
        },
        // The build's first view is in the root, so the demo shows before its
        // modules have loaded.
        holdsTheFirstView: () => {
            const html = concat(element(['body', ...demoSection({ path: '/a/demo.f.mjs', view: ['p', 'hi'] })]))
            assert(html.includes('<div data-demo="/a/demo.f.mjs"><p>hi</p></div>'), html)
        },
        // A click before the runtime loads would go nowhere, so every control
        // the runtime hears a click on is disabled, in any case; fields and
        // other inputs are left as they are.
        disablesItsActions: () => {
            const html = concat(element(['body', ...demoSection({ path: '/a/demo.f.mjs', view: ['div',
                ['button', { name: 'go' }, 'Go'],
                ['p', ['BUTTON', 'nested']],
                ['input', { type: 'Button', name: 'b' }],
                ['input', { name: 't' }],
                ['input', { type: 'checkbox', name: 'c' }]] })]))
            assert(html.includes('<button name="go" disabled="">Go</button>'), html)
            assert(html.includes('<p><BUTTON disabled="">nested</BUTTON></p>'), html)
            assert(html.includes('<input type="Button" name="b" disabled="">'), html)
            assert(html.includes('<input name="t"><input type="checkbox" name="c">'), html)
        },
        // An SVG control has no `disabled`, so it is marked `aria-disabled`.
        marksItsSvgActions: () => {
            const html = concat(element(['body', ...demoSection({ path: '/a/demo.f.mjs', view: ['svg',
                ['circle', { 'data-demo-click': 'p', tabindex: '0' }],
                ['circle', { 'data-demo-drag': 'x' }],
                ['circle', { r: '1' }]] })]))
            assert(html.includes('<circle data-demo-click="p" tabindex="0" aria-disabled="true"></circle>'), html)
            assert(html.includes('<circle data-demo-drag="x" aria-disabled="true"></circle>'), html)
            assert(html.includes('<circle r="1"></circle>'), html)
        },
    },
    directoryLayout: {
        catalogueBesideMain: () => {
            const dir = { ...empty, path: 'fjs', files: ['module.f.mjs'], todo: ['a.md'] }
            const html = concat(element(directoryLayout({ ...local, commit })(dir)(['main', ['h1', 'fjs']])))
            const asideEnd = html.indexOf('</aside>')
            assert(html.startsWith('<div data-directory-layout=""><aside data-catalogue="" aria-label="Directory catalogue">'), html)
            assert(html.indexOf('<h2>Contents</h2>') < asideEnd, html)
            assert(html.indexOf('<h2>Issues</h2>') < asideEnd, html)
            assert(html.includes(`${repository}/blob/${commit}/fjs/module.f.mjs`), html)
            assert(html.endsWith('</aside><main><h1>fjs</h1></main></div>'), html)
        },
        emptyCatalogue: () => assertEq(
            concat(element(directoryLayout(local)(empty)(['main']))),
            '<div data-directory-layout=""><aside data-catalogue="" aria-label="Directory catalogue"></aside><main></main></div>'),
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
        // The header comes first, outside the page's own `main`.
        header: () => {
            const html = pageHtml({ ...empty, path: 'fjs' })
            assert(html.includes('<body><header><nav aria-label="Site">'), html)
            assert(html.includes('</header><div data-directory-layout=""><aside'), html)
        },
        // The page names its language, names itself in the tab, and links the
        // stylesheet and the favicon.
        head: () => {
            const html = pageHtml({ ...empty, path: 'fjs' })
            assert(html.includes('<html lang="en">'), html)
            // What the page is, then the site, so a narrowed tab keeps the path.
            assert(html.includes('<title>fjs · FunctionalScript</title>'), html)
            const referrer = html.indexOf('<meta name="referrer" content="no-referrer">')
            assert(referrer >= 0 && referrer < html.indexOf('<link rel="stylesheet"'), html)
            assert(html.includes('<link rel="stylesheet" href="/_main.css">'), html)
            assert(html.includes('<link rel="icon" href="/favicon.ico" sizes="32x32">'), html)
            assert(html.includes('<link rel="icon" type="image/svg+xml" href="/fjs/website/favicon.svg">'), html)
        },
        // A demo stays in main while the catalogue lives beside it.
        carriesADemo: () => {
            const html = pageHtml({ ...empty, path: 'a', files: ['demo.f.mjs'], demo: { path: '/a/demo.f.mjs', view: null } })
            assert(html.includes('data-demo="/a/demo.f.mjs"'), html)
            assert(html.indexOf('<h2>Contents</h2>') < html.indexOf('</aside>'), html)
            assert(html.indexOf('<h2>Demo</h2>') > html.indexOf('<main'), html)
        },
        // A crate's page links its API reference under its heading, and a
        // directory without one says nothing about it.
        linksItsApi: () => {
            const html = pageHtml({ ...empty, path: 'nanvm-lib', api: '/cargo.doc/nanvm_lib/index.html' })
            assert(html.includes('<h1>nanvm-lib</h1><p><a href="/cargo.doc/nanvm_lib/index.html">API documentation</a></p>'), html)
            assert(!pageHtml({ ...empty, path: 'a' }).includes('API documentation'), 'no link without a reference')
        },
        // The directory above the crates links the reference's index.
        linksTheApiIndex: () => {
            const html = pageHtml({ ...empty, path: 'nanvm', apiIndex: '/cargo.doc/index.html' })
            assert(html.includes('<h1>nanvm</h1><p><a href="/cargo.doc/index.html">Rust API documentation</a></p>'), html)
        },
        // The catalogue is the same one the root page carries.
        carriesSections: () => {
            const dir = { ...empty, path: 'fjs', dirs: ['types'] }
            assert(pageHtml(dir).includes(
                '<details data-section="" open=""><summary><h2>Contents</h2></summary>'
                + '<ul data-links=""><li><a href="/fjs/types/index.html" data-kind="dir">types</a></li></ul></details>'),
                pageHtml(dir))
        },
    },
}
