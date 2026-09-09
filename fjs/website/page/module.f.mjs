/**
 * The directory page: what one directory of the repository looks like as
 * HTML.
 *
 * **Every link is root-relative.** A page at `fjs/types/list/index.html` and
 * the root page write the same href for the same target, so a link is built
 * from the repository path alone and never from where the page happens to
 * sit. The stylesheet is already linked this way, and the demo runtime will
 * be for the same reason: a relative specifier is resolved against something,
 * and the page is not always that something.
 *
 * The builder is split in two because the root page is not built here. It
 * carries the site's own heading and the browser test runner, so it takes
 * {@link sections} and keeps its own frame, while every other directory gets
 * the whole page from {@link page}. Both write the same three sections, which
 * is the property that matters — a reader moving between them sees one
 * catalogue, not two.
 *
 * @module
 *
 * @import { Element, Node } from '../../media/html/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Dir } from './types.ts'
 */

import { htmlUtf8 } from '../../media/html/module.f.mjs'
import { stylesheetLink } from '../style/module.f.mjs'

/**
 * The page for a directory path, as a root-relative URL.
 *
 * The root's page is `/index.html` rather than `/./index.html`: `'.'` is the
 * path of the repository root, and a URL says that by having no segments at
 * all.
 *
 * @type {(path: string) => string}
 */
export const pageHref = path => path === '.' ? '/index.html' : `/${path}/index.html`

/**
 * A file in a directory, as a root-relative URL.
 *
 * @type {(path: string) => (name: string) => string}
 */
const fileHref = path => name => path === '.' ? `/${name}` : `/${path}/${name}`

/**
 * A section with a heading, or nothing at all when the list is empty.
 *
 * An empty section is omitted rather than rendered with an empty list, so a
 * page says only what is true of its directory: no "Files" heading over
 * nothing on a directory that groups others, and no "Issues" heading where
 * none are filed.
 *
 * @type {(heading: string) => (items: readonly Element[]) => readonly Node[]}
 */
const section = heading => items =>
    items.length === 0 ? [] : [['h2', heading], ['ul', ...items]]

/** @type {(href: string) => (text: string) => Element} */
const item = href => text => ['li', ['a', { href }, text]]

/**
 * The catalogue of one directory: its files, its subdirectories, and the
 * issues filed against it.
 *
 * The root page inserts these into its own frame; {@link page} wraps them in
 * one. Nothing here depends on which of the two is calling.
 *
 * @type {(dir: Dir) => readonly Node[]}
 */
export const sections = dir => [
    ...section('Files')(dir.files.map(name =>
        item(fileHref(dir.path)(name))(name))),
    ...section('Directories')(dir.dirs.map(name =>
        item(pageHref(dir.path === '.' ? name : `${dir.path}/${name}`))(`${name}/`))),
    ...section('Issues')(dir.todo.map(name =>
        item(fileHref(dir.path)(`todo/${name}`))(name))),
]

/**
 * The path to each ancestor of `path`, root first, paired with the name to
 * show for it. The directory itself is not included: a page does not link to
 * itself.
 *
 * @type {(path: string) => readonly (readonly [string, string])[]}
 */
const ancestors = path => {
    const segments = path.split('/')
    return [
        /** @type {const} */ (['.', 'root']),
        ...segments.slice(0, -1).map((name, at) =>
            /** @type {const} */ ([segments.slice(0, at + 1).join('/'), name])),
    ]
}

/**
 * The whole page for a directory below the root: where it sits, what it
 * holds, and what is open against it.
 *
 * @type {(dir: Dir) => Vec}
 */
export const page = dir => htmlUtf8(
    ['title', dir.path],
    stylesheetLink,
)(
    ['nav', ...ancestors(dir.path).flatMap(([path, name], at) => {
        /** @type {Element} */
        const link = ['a', { href: pageHref(path) }, name]
        return at === 0 ? [link] : [' / ', link]
    })],
    ['h1', dir.path],
    ...sections(dir),
)
