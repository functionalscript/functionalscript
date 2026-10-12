/**
 * The Rust API reference: where rustdoc's output is read from, where the site
 * publishes it, and the page that lists the crates it documents.
 *
 * **rustdoc's pages are published as they are.** One `cargo doc --workspace`
 * writes one search index and one `static.files/` for every crate, so the
 * whole of `target/doc` moves under {@link cargoDocDir} together, and nothing
 * here rewrites it. The one page that is ours is {@link cargoDocPage}: stable
 * rustdoc writes no root page, and that page is also the way back to the rest
 * of the site.
 *
 * **rustdoc's pages carry the site's header and footer**, which rustdoc puts
 * on every page it writes when `cargo doc` is given them — see
 * {@link rustdocHeader}. They are rustdoc's to place, not ours to splice in:
 * its output is still copied as it is.
 *
 * @module
 *
 * @import { Element } from '../../media/html/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Build } from '../page/types.ts'
 * @import { Funding } from '../funding/types.ts'
 */

import { element } from '../../media/html/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { footer, header, pageTitle, shell } from '../page/module.f.mjs'
import { faviconLinks } from '../style/module.f.mjs'

/**
 * Where `cargo doc` writes, which the build reads and never serves: `target/`
 * holds build artifacts beside the docs.
 *
 * @type {string}
 */
export const rustdocDir = 'target/doc'

/** The root directory the site publishes rustdoc's output under. @type {string} */
export const cargoDocDir = 'cargo.doc'

/**
 * The crate a directory holds, as rustdoc spells it: the directory's path with
 * `/` and `-` read as `_`, so `nanvm/lib` is documented as `nanvm_lib` and
 * `nanvm/effects-node` as `nanvm_effects_node`. That is the workspace's
 * convention — the package in `nanvm/lib` is named `nanvm-lib` — and a
 * directory that breaks it is not linked rather than linked wrong, because
 * only a crate rustdoc documented is.
 *
 * @type {(path: string) => string}
 */
export const crateOf = path => path.split('/').join('_').split('-').join('_')

/**
 * A documented crate's page, root-relative.
 *
 * @type {(crate: string) => string}
 */
export const crateHref = crate => `/${cargoDocDir}/${crate}/index.html`

/** The index of the Rust API reference, root-relative. @type {string} */
export const cargoDocHref = `/${cargoDocDir}/index.html`

/**
 * The index of the Rust API reference: one link per documented crate.
 *
 * @type {(build: Build) => (crates: readonly string[]) => Vec}
 */
export const cargoDocPage = build => crates => shell(build)(pageTitle('Rust API'))(['main',
    ['h1', 'Rust API'],
    ['p', 'The workspace’s crates, documented by ', ['code', 'cargo doc'], '.'],
    ['ul', ...crates.map(crate => /** @type {Element} */ (['li', ['a', { href: crateHref(crate) }, crate]]))],
])

/**
 * Where `rustdoc-bars` writes the site's header for rustdoc, which `cargo doc`
 * takes as `--html-before-content`. `_`-prefixed, as `_main.css` is: generated
 * output the site serves and git ignores.
 *
 * @type {string}
 */
export const rustdocHeaderPath = '_rustdoc-header.html'

/** Where `rustdoc-bars` writes the favicon links for rustdoc, `--html-in-header`. @type {string} */
export const rustdocHeadPath = '_rustdoc-head.html'

/** The site's shared favicon links, serialized for rustdoc's `<head>`. @type {string} */
export const rustdocHead = faviconLinks.map(e => concat(element(e))).join('')

/** Where `rustdoc-bars` writes the site's footer for rustdoc, `--html-after-content`. @type {string} */
export const rustdocFooterPath = '_rustdoc-footer.html'

/** Where `rustdoc-bars` writes the stylesheet for rustdoc, `--extend-css`. @type {string} */
export const rustdocStylesheetPath = '_rustdoc.css'

/**
 * The site's header, as the HTML rustdoc puts at the top of every page: the
 * same {@link header} every other page opens with, so the two cannot drift.
 *
 * @type {(build: Build) => string}
 */
export const rustdocHeader = build => concat(element(header(build)))

/**
 * The site's funding footer, as the HTML rustdoc puts at the end of every
 * page: the same {@link footer} every other page closes with, and nothing
 * when there are no channels.
 *
 * @type {(funding: readonly Funding[]) => string}
 */
export const rustdocFooter = funding => footer(funding).map(e => concat(element(e))).join('')
