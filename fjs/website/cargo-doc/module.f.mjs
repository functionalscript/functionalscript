/**
 * The Rust API reference: where rustdoc's output is read from, where the site
 * publishes it, and the page that lists the crates it documents.
 *
 * **rustdoc's pages are published as they are, but for their URL.** One
 * `cargo doc --workspace` writes one search index and one `static.files/` for
 * every crate, so the whole of `target/doc` moves under {@link cargoDocDir}
 * together. The one change on the way is a page's `og:url`
 * ({@link withPageUrl}), which only the copy knows. The one page that is ours
 * is {@link cargoDocPage}: stable rustdoc writes no root page, and that page
 * is also the way back to the rest of the site.
 *
 * **rustdoc's pages carry the site's header and footer**, which rustdoc puts
 * on every page it writes when `cargo doc` is given them — see
 * {@link rustdocHeader}. They are rustdoc's to place, not ours to splice in:
 * its output is still copied as it is.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { Build } from '../page/types.ts'
 * @import { Funding } from '../funding/types.ts'
 */

import { element } from '../../media/html/module.f.js'
import { concat } from '../../types/string/module.f.js'
import { footer, header, pageTitle, shell, siteDescription, siteMeta, urlMeta } from '../page/module.f.mjs'
import { byteLength, msb, uint, vec } from '../../types/bit_vec/module.f.js'
import { utf8 } from '../../text/module.f.js'
import { origin } from '../origin/module.f.js'
import { faviconLinks } from '../style/module.f.js'

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
 * @type {(build: Build) => (crates: readonly string[]) => string}
 */
export const cargoDocPage = build => crates => shell(build)({ href: cargoDocHref, title: pageTitle('Rust API'), description: siteDescription })(['main',
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

/** Where `rustdoc-bars` writes the favicon links and card tags for rustdoc, `--html-in-header`. @type {string} */
export const rustdocHeadPath = '_rustdoc-head.html'

/**
 * Where a rustdoc page's `og:url` goes: the comment that ends
 * {@link rustdocHead}, which {@link withPageUrl} replaces as the page is
 * copied. A comment, so a page that keeps it shows nothing.
 *
 * @type {string}
 */
export const pageUrlMarker = '<!--og:url-->'

/**
 * What rustdoc adds to every page's `<head>`: the site's favicon links, the
 * card tags every page shares ({@link siteMeta}), serialized, and the
 * {@link pageUrlMarker} for the one tag that is not shared.
 *
 * @type {(build: Build) => string}
 */
export const rustdocHead = build => [...faviconLinks, ...siteMeta(origin(build.branch))].map(e => concat(element(e))).join('') + pageUrlMarker

/** The marker's bytes, as a page holds them. */
const markerVec = utf8(pageUrlMarker)

/**
 * Where the marker's bytes first start in `v`, a byte offset, or `null`.
 *
 * **A search for our own bytes, not over rustdoc's markup.** It reads nothing
 * of the page: the marker is a fixed string we gave rustdoc, which pastes it
 * as it is, so the bytes are found or not and nothing in between is
 * interpreted. The hex digits are the bytes two to a byte, so a match is one
 * at an even digit.
 *
 * @type {(v: Vec) => number | null}
 */
const markerAt = v => {
    const digits = Number(byteLength(v)) * 2
    const hex = uint(v).toString(16).padStart(digits, '0')
    const marker = uint(markerVec).toString(16).padStart(Number(byteLength(markerVec)) * 2, '0')
    /** @type {(from: number) => number | null} */
    const from = start => {
        const at = hex.indexOf(marker, start)
        return at < 0 ? null : at % 2 === 0 ? at / 2 : from(at + 1)
    }
    return from(0)
}

/**
 * A rustdoc page, as the chunks it was read in, with its `og:url`: the
 * {@link pageUrlMarker} replaced by the page's {@link urlMeta} for `href`,
 * its root-relative URL. The page is unchanged where the build has no origin,
 * and where it holds no marker — `cargo doc` run without
 * {@link rustdocHead}, or a page rustdoc writes without it, such as a
 * redirect.
 *
 * **The first marker in the first chunk**, which is the head's: rustdoc
 * pastes the head into `<head>`, ahead of any of the page's own content, a
 * doc comment's HTML included, and a head is a few KiB where a chunk is
 * 128.
 *
 * **Cut into more chunks, not joined into fewer**: the bytes before the
 * marker, the tag, and the bytes after it. A page is written chunk by chunk,
 * so the cut never has to fit a joined chunk inside a `Vec`.
 *
 * @type {(origin: string | null) => (href: string) => (chunks: readonly Vec[]) => readonly Vec[]}
 */
export const withPageUrl = origin => href => chunks => {
    if (origin === null || chunks.length === 0) { return chunks }
    const [first, ...rest] = chunks
    const at = markerAt(first)
    if (at === null) { return chunks }
    const before = BigInt(at) * 8n
    const tag = utf8(urlMeta(origin)(href).map(e => concat(element(e))).join(''))
    return [vec(before)(msb.front(before)(first)), tag, msb.removeFront(before + byteLength(markerVec) * 8n)(first), ...rest]
}

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
