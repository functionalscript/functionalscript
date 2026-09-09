/**
 * @import { Dir } from './types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { element } from '../../media/html/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { utf8ToString } from '../../text/module.f.mjs'
import { page, pageHref, sections } from './module.f.mjs'

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
            '<body><h2>Files</h2><ul><li><a href="/fjs/types/list/module.f.mjs">module.f.mjs</a></li></ul></body>'),
        // A file of the root directory has no directory in its path.
        filesAtRoot: () => assertEq(
            sectionsHtml({ ...empty, files: ['module.f.mjs'] }),
            '<body><h2>Files</h2><ul><li><a href="/module.f.mjs">module.f.mjs</a></li></ul></body>'),
        // A subdirectory link points at a page, and every such page exists —
        // which is what the "every directory gets one" rule buys.
        dirs: () => assertEq(
            sectionsHtml({ ...empty, path: 'fjs', dirs: ['types'] }),
            '<body><h2>Directories</h2><ul><li><a href="/fjs/types/index.html">types/</a></li></ul></body>'),
        dirsAtRoot: () => assertEq(
            sectionsHtml({ ...empty, dirs: ['fjs'] }),
            '<body><h2>Directories</h2><ul><li><a href="/fjs/index.html">fjs/</a></li></ul></body>'),
        // An issue is linked inside the `todo/` it was filed in, which has no
        // page of its own.
        todo: () => assertEq(
            sectionsHtml({ ...empty, path: 'fjs', todo: ['a.md'] }),
            '<body><h2>Issues</h2><ul><li><a href="/fjs/todo/a.md">a.md</a></li></ul></body>'),
        todoAtRoot: () => assertEq(
            sectionsHtml({ ...empty, todo: ['a.md'] }),
            '<body><h2>Issues</h2><ul><li><a href="/todo/a.md">a.md</a></li></ul></body>'),
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
                '<h2>Directories</h2><ul><li><a href="/fjs/types/index.html">types/</a></li></ul>'),
                pageHtml(dir))
        },
    },
}
