/**
 * @import { Dir } from './types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { element } from '../../media/html/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { utf8ToString } from '../../text/module.f.mjs'
import { page, pageHref, report, sections } from './module.f.mjs'

/** @type {(dir: Dir) => string} */
const sectionsHtml = dir => concat(element(['body', ...sections(dir)]))

/** @type {(dir: Dir) => string} */
const pageHtml = dir => utf8ToString(page(dir))

/** @type {Dir} */
const empty = { path: '.', files: [], dirs: [], todo: [] }

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
    report: {
        /**
         * **Closed, and it stays closed until a reader opens it.** A run
         * appends a row per test and the catalogue sits below; a report that
         * opened itself would answer "did it pass" by burying the rest of the
         * page. There is no `open` attribute, which is what says so.
         */
        closed: () => {
            const html = concat(element(['body', report]))
            assert(html.startsWith('<body><details data-test-report=""><summary>Results</summary>'), html)
            assert(!html.includes('open'), html)
        },
        // The runner finds its list by the hook it has always used, so the
        // disclosure around it changes nothing it does.
        keepsTheRunnersHook: () =>
            assert(concat(element(['body', report])).includes('<ol data-test-results="">'),
                concat(element(['body', report]))),
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
