/**
 * @import { Build, Dir } from './types.ts'
 * @import { Issue } from '../issue/types.ts'
 * @import { Node } from '../../media/html/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { element } from '../../media/html/module.f.mjs'
import { concat, occurrences } from '../../types/string/module.f.js'
import { demoSection, directoryLayout, footer, header, fileHref, issueOrder, page, pageHref, pagePath, cardImageHref, siteMeta, descriptionLimit, readmeDescription, repository, sections, siteDescription, subtree, testSection, urlPath } from './module.f.mjs'
import { origin, productionOrigin } from '../origin/module.f.js'

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
 * The Issues section around `items`, collapsed, as the body it is the whole of.
 *
 * @type {(items: string) => string}
 */
const issues = items => '<body><details data-section=""><summary><h2>Issues</h2></summary>'
    + `<ul data-links="">${items}</ul></details></body>`

/**
 * An open P3 issue named `name`: what the header is does not change how a
 * page links it.
 *
 * @type {(name: string) => Issue}
 */
const issue = name => ({ name, status: 'open', priority: 'P3' })

/** @type {Dir} */
const empty = { path: '.', files: [], dirs: [], demoDirs: [], todo: [], proofs: [], readme: [], demo: null, api: null, apiIndex: null }

export const proof = {
    readmeDescription: {
        // A paragraph of badges has no text, so the next paragraph is the
        // description, its links read as their text.
        skipsBadges: () => assertEq(readmeDescription([['article', { 'data-readme': '' },
            ['h2', 'Title'],
            ['p', ['a', { href: 'x' }, ['img', { alt: 'badge' }]]],
            ['p', ' A ', ['a', { href: 'y' }, 'safe'], ' language. '],
            ['p', 'Second.']]]), 'A safe language.'),
        // A field opens many READMEs; the prose after it is the description.
        // A bold lead-in that ends with a period is prose, not a field.
        skipsFields: () => assertEq(readmeDescription([['article', { 'data-readme': '' },
            ['p', ['strong', 'Status:'], ' implemented'],
            ['p', ['strong', 'A lead-in, not a field'], ' opens this prose.']]]),
            'A lead-in, not a field opens this prose.'),
        // The first sentence describes the page, the rest of the paragraph
        // does not; `!` and `?` end a sentence too.
        firstSentence: () => {
            const of = (/** @type {readonly Node[]} */ ...p) => readmeDescription([['article', { 'data-readme': '' }, ['p', ...p]]])
            assertEq(of('One. Two.'), 'One.')
            assertEq(of('Why? Because.'), 'Why?')
            assertEq(of('Stop! Go.'), 'Stop!')
            // A character outside the BMP is two code units, and shifts
            // nothing: the sentence still ends at its period.
            assertEq(of('😀 hello. Second sentence.'), '😀 hello.')
            // No sentence end inside a word or at a decimal point.
            assertEq(of('Version 1.5 is a.b and more'), 'Version 1.5 is a.b and more')
        },
        // Punctuation in code is an operator, not the end of a sentence.
        codeIsNotASentenceEnd: () => assertEq(readmeDescription([['article', { 'data-readme': '' },
            ['p', 'Has ', ['code', 'a! b'], ' and ', ['a', { href: 'x' }, ['code', '?. x']], ' both. Then more.']]]),
            'Has a! b and ?. x both.'),
        // A sentence over the limit is cut at a word, without the punctuation
        // before the cut, and says so.
        limit: () => {
            const of = (/** @type {string} */ t) => readmeDescription([['article', { 'data-readme': '' }, ['p', t]]])
            const exact = `${'a'.repeat(descriptionLimit - 1)}.`
            assertEq(of(exact), exact)
            const words = 'word, '.repeat(40)
            const cut = of(words)
            assert(cut !== undefined && cut.length <= descriptionLimit && cut.endsWith('word…'), String(cut))
            // One word longer than the limit is cut inside it.
            assertEq(of('x'.repeat(200)), `${'x'.repeat(descriptionLimit - 1)}…`)
            // A cut never splits a character in two: 79 whole emoji fit
            // before the ellipsis, and the 80th would be cut in half.
            assertEq(of('😀'.repeat(100)), `${'😀'.repeat(79)}…`)
        },
        // A README this site does not render is a note about it, not its text.
        refused: () => assertEq(readmeDescription([['p', { 'data-readme-refused': '' }, 'README.md is not rendered here.']]), undefined),
        // A README of headings alone describes nothing.
        noParagraph: () => assertEq(readmeDescription([['article', { 'data-readme': '' }, ['h2', 'Title'], 'text']]), undefined),
        none: () => assertEq(readmeDescription([]), undefined),
    },
    issueNameOrder: () => assertEq(issueOrder(issue('z.md'), issue('a.md')), 1),
    fileHref: () => {
        assertEq(fileHref(null)('nanvm/demos/wasm')('hello.wat'), '/nanvm/demos/wasm/hello.wat')
        assertEq(fileHref(commit)('nanvm/demos/wasm')('hello.wat'), '/nanvm/demos/wasm/hello.wat')
        assertEq(fileHref(commit)('nanvm/demos/wasm-old')('hello.wat'), `${repository}/blob/${commit}/nanvm/demos/wasm-old/hello.wat`)
    },
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
     * linking home, the CLI, the pull requests, the releases, the
     * playground, and the repository.
     */
    header: {
        links: () => assertEq(headerHtml(local),
            '<header><nav aria-label="Site">'
            + '<a href="/index.html" data-home=""><img src="/fjs/website/favicon.svg" alt="" width="24" height="24">FunctionalScript</a>'
            + '<span data-site-links=""><a href="/cli/">CLI</a><a href="/prs/index.html">PRs</a><a href="/changelog/index.html">Releases</a>'
            + '<a href="/fjs/website/playground/index.html">Playground</a>'
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
    urlPath: () => assertEq(urlPath('fjs/a#b/c?d/100%/%20/é x/_card.html'), 'fjs/a%23b/c%3Fd/100%25/%2520/%C3%A9%20x/_card.html'),
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
            sectionsHtml({ ...empty, path: 'fjs/types/list', files: ['module.f.js'] }),
            contents('<li><a href="/fjs/types/list/module.f.js" data-kind="file">module.f.js</a></li>')),
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
         * **Issues start collapsed after the open Contents list.** Readers
         * can expand Issues with its disclosure control.
         */
        issuesSeparateAndCollapsed: () => {
            const html = sectionsHtml({ ...empty, path: 'fjs', todo: [issue('a.md')], files: ['module.f.mjs'] })
            assertEq(html,
                '<body><details data-section="" open=""><summary><h2>Contents</h2></summary>'
                + '<ul data-links=""><li><a href="/fjs/module.f.mjs" data-kind="file">module.f.mjs</a></li></ul></details>'
                + '<details data-section=""><summary><h2>Issues</h2></summary>'
                + '<ul data-links=""><li><span data-priority="P3">P3</span> <a href="/fjs/todo/a.md" data-kind="issue" data-issue-status="open">a.md</a></li></ul></details></body>')
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
            sectionsHtml({ ...empty, path: 'fjs', todo: [issue('a.md')] }),
            issues('<li><span data-priority="P3">P3</span> <a href="/fjs/todo/a.md" data-kind="issue" data-issue-status="open">a.md</a></li>')),
        todoAtRoot: () => assertEq(
            sectionsHtml({ ...empty, todo: [issue('a.md')] }),
            issues('<li><span data-priority="P3">P3</span> <a href="/todo/a.md" data-kind="issue" data-issue-status="open">a.md</a></li>')),
        /**
         * **Issues are listed by priority, then status, then name**, each
         * with its priority as a badge before it and its status as the icon:
         * the P1s first rather than wherever their names sort, and within one
         * priority work in progress before work not started, the records
         * after both.
         */
        todoOrder: () => {
            /** @type {(name: string, status: Issue['status'], priority: Issue['priority']) => string} */
            const entry = (name, status, priority) =>
                `<li><span data-priority="${priority}">${priority}</span> <a href="/todo/${name}" data-kind="issue" data-issue-status="${status}">${name}</a></li>`
            assertEq(
                sectionsHtml({ ...empty, todo: [
                    { name: 'z.md', status: "won't fix", priority: 'P5' },
                    { name: 'c.md', status: 'open', priority: 'P2' },
                    { name: 'd.md', status: 'done', priority: 'P1' },
                    { name: 'b.md', status: 'blocked', priority: 'P1' },
                    { name: 'a.md', status: 'open', priority: 'P2' },
                    { name: 'x.md', status: 'open', priority: 'P1' },
                    { name: 'y.md', status: 'wip', priority: 'P4' },
                ] }),
                issues([
                    entry('x.md', 'open', 'P1'),
                    entry('b.md', 'blocked', 'P1'),
                    entry('d.md', 'done', 'P1'),
                    entry('a.md', 'open', 'P2'),
                    entry('c.md', 'open', 'P2'),
                    entry('y.md', 'wip', 'P4'),
                    entry('z.md', "won't fix", 'P5'),
                ].join('')))
        },
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
                sectionsHtml({ ...empty, path: 'fjs', todo: [issue('open issue.md')] }),
                issues('<li><span data-priority="P3">P3</span> <a href="/fjs/todo/open%20issue.md" data-kind="issue" data-issue-status="open">open issue.md</a></li>')),
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
            // Cloudflare builds know their commit, but these assets exist only
            // on the deployed site. Source files still link to GitHub below.
            generatedWasm: () => assertEq(
                sectionsAtCommit({ ...empty, path: 'nanvm/demos/wasm', files: ['nanvm_demos.wasm', 'hello.wat'] }),
                contents('<li><a href="/nanvm/demos/wasm/nanvm_demos.wasm" data-kind="file">nanvm_demos.wasm</a></li><li><a href="/nanvm/demos/wasm/hello.wat" data-kind="file">hello.wat</a></li>')),
            files: () => assertEq(
                sectionsAtCommit({ ...empty, path: 'fjs/types/list', files: ['module.f.js'] }),
                contents(`<li><a href="${repository}/blob/${commit}/fjs/types/list/module.f.js" data-kind="file">module.f.js</a></li>`)),
            filesAtRoot: () => assertEq(
                sectionsAtCommit({ ...empty, files: ['README.md'] }),
                contents(`<li><a href="${repository}/blob/${commit}/README.md" data-kind="file">README.md</a></li>`)),
            todo: () => assertEq(
                sectionsAtCommit({ ...empty, path: 'fjs', todo: [issue('a.md')] }),
                issues(`<li><span data-priority="P3">P3</span> <a href="${repository}/blob/${commit}/fjs/todo/a.md" data-kind="issue" data-issue-status="open">a.md</a></li>`)),
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
            assert(html.includes('data-copy-fragment="emergent-testing"'), html)
            assert(html.includes('<span data-test-counts=""></span></summary>'), html)
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
            assert(html.includes('<summary><h2 id="emergent-testing">Emergent Testing</h2><span data-permalink="">'), html)
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
            assert(html.includes('<summary><h2 id="demo">Demo</h2><span data-permalink="">'), html)
            assert(html.includes('<div data-demo="/a/demo.f.mjs" data-demo-scope="/a/demo.f.mjs"></div>'), html)
            assert(html.includes("import { startDemo } from '/fjs/website/demo-runtime.mjs'"), html)
            const summary = html.slice(html.indexOf('<summary>'), html.indexOf('</summary>'))
            assert(summary.includes('data-copy-demo=""'), html)
            assert(summary.includes('data-demo-link-status=""'), html)
            assertEq(occurrences('data-copy-demo=""')(html), 1)
        },
        scopedControlsBeforeScripts: () => {
            const html = concat(element(['body', ...demoSection({ path: '/a/demo.f.mjs', view: ['p',
                ['label', { for: 'json' }, 'JSON'], ['input', { id: 'json', name: 'json' }]] }, 'second')]))
            assert(html.includes('data-demo-scope="second"'))
            assert(html.includes("root.getAttribute('data-demo-scope') === \"second\""))
            assert(html.includes('for="demo-control:6:second:json"'))
            assert(html.includes('id="demo-control:6:second:json" name="json"'))
        },
        repeatedSections: () => {
            const html = concat(element(['body',
                ...demoSection({ path: '/a/demo.f.mjs', view: ['input', { id: 'x', name: 'x' }] }),
                ...demoSection({ path: '/a/demo.f.mjs', view: ['input', { id: 'x', name: 'x' }] }, 'second'),
            ]))
            assertEq(occurrences('id="demo"')(html), 1)
            assert(html.includes('id="demo-section:6:second"'))
            assert(html.includes('id="demo-control:13:/a/demo.f.mjs:x"'))
            assert(html.includes('id="demo-control:6:second:x"'))
        },
        scopeScriptEscaping: () => {
            const html = concat(element(['body', ...demoSection({ path: '/a/demo.f.mjs', view: null }, 'one"</script>')]))
            assert(html.includes('\\u003c/script>'))
            assertEq(occurrences('</script>')(html), 1)
        },
        // The build's first view is in the root, so the demo shows before its
        // modules have loaded.
        holdsTheFirstView: () => {
            const html = concat(element(['body', ...demoSection({ path: '/a/demo.f.mjs', view: ['p', 'hi'] })]))
            assert(html.includes('<div data-demo="/a/demo.f.mjs" data-demo-scope="/a/demo.f.mjs"><p>hi</p></div>'), html)
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
            const dir = { ...empty, path: 'fjs', files: ['module.f.mjs'], todo: [issue('a.md')] }
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
         * The breadcrumb is the page's heading: every ancestor as a link, then
         * the directory itself as text, since a page does not link to the page
         * it is.
         */
        breadcrumb: () => {
            const html = pageHtml({ ...empty, path: 'fjs/types/list' })
            assert(html.includes(
                '<nav aria-label="Breadcrumb"><h1><a href="/index.html">root</a> / <a href="/fjs/index.html">fjs</a>'
                + ' / <a href="/fjs/types/index.html">types</a> / <span aria-current="page">list</span></h1></nav>'), html)
            assert(!html.includes('list/index.html'), html)
        },
        // One directory below the root has the root as its only ancestor.
        breadcrumbOneDeep: () => {
            const html = pageHtml({ ...empty, path: 'fjs' })
            assert(html.includes('<h1><a href="/index.html">root</a> / <span aria-current="page">fjs</span></h1>'), html)
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
        // A pasted link's card names the page, what it is about and the site,
        // from the static page alone; without a README, the site describes it.
        previewMeta: () => {
            const html = pageHtml({ ...empty, path: 'fjs' })
            assert(html.includes(
                `<meta name="description" content="${siteDescription}">`
                + '<meta property="og:title" content="fjs · FunctionalScript">'
                + `<meta property="og:description" content="${siteDescription}">`
                + '<meta property="og:site_name" content="FunctionalScript">'
                + '<meta property="og:type" content="website">'
                + '<meta name="twitter:card" content="summary">'), html)
        },
        // A build of `main` is production, so its page gives its own URL;
        // a local build, above, gives none. Without a README, the page shows
        // the root page's card, named for the site.
        productionUrl: () => {
            const html = page({ ...local, branch: 'main' })({ ...empty, path: 'fjs/types' })
            assert(html.includes(
                `<meta property="og:url" content="${productionOrigin}/fjs/types/index.html">`
                + '<meta property="og:site_name" content="FunctionalScript">'
                + '<meta property="og:type" content="website">'
                + `<meta property="og:image" content="${productionOrigin}/_card.png">`
                + '<meta property="og:image:alt" content="FunctionalScript">'
                + '<meta name="twitter:card" content="summary_large_image">'), html)
            const localHtml = pageHtml({ ...empty, path: 'fjs' })
            assert(!localHtml.includes('og:url') && !localHtml.includes('og:image'), 'no origin, no URL and no image')
        },
        // A preview's page gives its URL and image at the preview's own origin.
        previewUrl: () => {
            const preview = origin('claude/x')
            const html = page({ ...local, branch: 'claude/x' })({ ...empty, path: 'fjs' })
            assert(html.includes(`<meta property="og:url" content="${preview}/fjs/index.html">`), html)
            assert(html.includes(`<meta property="og:image" content="${preview}/_card.png">`), html)
        },
        // The tags every page shares, rustdoc's included, show the root page's card.
        siteMeta: () => assertStructurallySame(siteMeta(productionOrigin).slice(2), [
            ['meta', { property: 'og:image', content: `${productionOrigin}/_card.png` }],
            ['meta', { property: 'og:image:alt', content: 'FunctionalScript' }],
            ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
        ]),
        // A page with a README shows its own card, named by the page's title;
        // a README the reader refused leaves it the root page's.
        ownCard: () => {
            const production = { ...local, branch: 'main' }
            const html = page(production)({ ...empty, path: 'fjs/a b', readme: [['article', { 'data-readme': '' }, ['p', 'All of it.']]] })
            assert(html.includes(
                `<meta property="og:image" content="${productionOrigin}${cardImageHref('fjs/a b')}">`
                + '<meta property="og:image:alt" content="fjs/a b · FunctionalScript">'), html)
            assertEq(cardImageHref('fjs/a b'), '/fjs/a%20b/_card.png')
            assertEq(cardImageHref('.'), '/_card.png')
            const refused = page(production)({ ...empty, path: 'fjs', readme: [['p', { 'data-readme-refused': '' }, 'no']] })
            assert(refused.includes(`<meta property="og:image" content="${productionOrigin}/_card.png">`), refused)
        },
        // A directory with a README is described by it.
        describedByItsReadme: () => {
            const html = pageHtml({ ...empty, path: 'fjs', readme: [['article', { 'data-readme': '' }, ['p', 'All of it.']]] })
            assert(html.includes('<meta name="description" content="All of it.">'), html)
            assert(html.includes('<meta property="og:description" content="All of it.">'), html)
        },
        // A demo stays in main while the catalogue lives beside it.
        carriesADemo: () => {
            const html = pageHtml({ ...empty, path: 'a', files: ['demo.f.mjs'], demo: { path: '/a/demo.f.mjs', view: null } })
            assert(html.includes('data-demo="/a/demo.f.mjs"'), html)
            assert(html.indexOf('<h2>Contents</h2>') < html.indexOf('</aside>'), html)
            assert(html.indexOf('<h2 id="demo">Demo</h2>') > html.indexOf('<main'), html)
        },
        // A crate's page links its API reference under its heading, and a
        // directory without one says nothing about it.
        linksItsApi: () => {
            const html = pageHtml({ ...empty, path: 'nanvm-lib', api: '/cargo.doc/nanvm_lib/index.html' })
            assert(html.includes('<span aria-current="page">nanvm-lib</span></h1></nav><p><a href="/cargo.doc/nanvm_lib/index.html">API documentation</a></p>'), html)
            assert(!pageHtml({ ...empty, path: 'a' }).includes('API documentation'), 'no link without a reference')
        },
        // The directory above the crates links the reference's index.
        linksTheApiIndex: () => {
            const html = pageHtml({ ...empty, path: 'nanvm', apiIndex: '/cargo.doc/index.html' })
            assert(html.includes('<span aria-current="page">nanvm</span></h1></nav><p><a href="/cargo.doc/index.html">Rust API documentation</a></p>'), html)
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
