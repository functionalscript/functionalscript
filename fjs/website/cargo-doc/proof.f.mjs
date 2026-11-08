/** @import { Vec } from '../../types/bit_vec/types.ts' */

import { assert, assertEq } from '../../asserts/module.f.js'
import { productionOrigin } from '../origin/module.f.js'
import { cargoDocHref, cargoDocPage, crateHref, crateOf, pageCrate, pageMetaMarker, rustdocHead, rustdocHeadPath, rustdocFooter, rustdocHeader, rustdocMeta, withPageMeta } from './module.f.mjs'
import { cardImageHref, pageTitle } from '../page/module.f.mjs'
import { element } from '../../media/html/module.f.mjs'
import { concat } from '../../types/string/module.f.js'
import { utf8 } from '../../text/module.f.mjs'
import { utf8ToString } from '../../text/utf8/module.f.mjs'
import { u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'

/** A page's chunks as the text they hold together. @type {(chunks: readonly Vec[]) => string} */
const textOf = chunks => chunks.map(utf8ToString).join('')

/** A page's `og:url` on production. */
const url = (/** @type {string} */ href) => `<meta property="og:url" content="${productionOrigin}${href}">`

const local = /** @type {const} */ ({ commit: null, branch: null, funding: [] })

/** The tags every card starts with. */
const site = '<meta property="og:site_name" content="FunctionalScript"><meta property="og:type" content="website">'

/** A crate page's tags, showing `nanvm/lib`'s card, serialized. */
const meta = (/** @type {string | null} */ origin) => rustdocMeta(origin)({ href: cardImageHref('nanvm/lib'), alt: pageTitle('nanvm/lib') })('/cargo.doc/a/index.html')
    .map(e => concat(element(e))).join('')

/** Some tags to put at the marker, and their text. */
const tags = /** @type {const} */ ([['meta', { property: 'og:url', content: 'https://x/p.html' }]])
const tagsText = '<meta property="og:url" content="https://x/p.html">'

export const proof = {
    crateOf: () => {
        assertEq(crateOf('nanvm/effects-node'), 'nanvm_effects_node')
        assertEq(crateOf('plain'), 'plain')
    },
    crateHref: () => assertEq(crateHref('nanvm_lib'), '/cargo.doc/nanvm_lib/index.html'),
    cargoDocHref: () => assertEq(cargoDocHref, '/cargo.doc/index.html'),
    page: () => {
        const html = cargoDocPage(local)(['nanvm_harness', 'nanvm_lib'])
        assert(html.includes('<title>Rust API · FunctionalScript</title>'), html)
        assert(html.includes('<h1>Rust API</h1>'), html)
        assert(html.includes('<li><a href="/cargo.doc/nanvm_harness/index.html">nanvm_harness</a></li><li><a href="/cargo.doc/nanvm_lib/index.html">nanvm_lib</a></li>'), html)
    },
    // The bars rustdoc puts on its pages are the site's own, as HTML
    // fragments: no document around them, since rustdoc places them.
    // The head carries the favicons and the marker the copy puts the card
    // tags at, which differ by page: the same for every build.
    rustdocHead: () => {
        assertEq(rustdocHeadPath, '_rustdoc-head.html')
        assertEq(rustdocHead, '<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" type="image/svg+xml" href="/fjs/website/favicon.svg">'
            + pageMetaMarker)
    },
    // A page belongs to the crate whose directory it is in, its source view
    // included; rustdoc's shared assets and pages belong to none.
    pageCrate: () => {
        const crate = pageCrate(['nanvm_lib'])
        assertEq(crate('nanvm_lib/index.html'), 'nanvm_lib')
        assertEq(crate('nanvm_lib/vm/struct.Vm.html'), 'nanvm_lib')
        assertEq(crate('src/nanvm_lib/lib.rs.html'), 'nanvm_lib')
        assertEq(crate('index.html'), null)
        assertEq(crate('static.files/main.css'), null)
        assertEq(crate('src/other/lib.rs.html'), null)
        assertEq(crate('trait.impl/core/index.html'), null)
    },
    // A page's URL, then its card's tags, as every other page of the site.
    rustdocMeta: {
        production: () => assertEq(meta(productionOrigin), url('/cargo.doc/a/index.html') + site
            + `<meta property="og:image" content="${productionOrigin}/nanvm/lib/_card.png">`
            + '<meta property="og:image:alt" content="nanvm/lib · FunctionalScript">'
            + '<meta name="twitter:card" content="summary_large_image">'),
        // A local build, with no origin: no URL, no image, the small card.
        local: () => assertEq(meta(null), `${site}<meta name="twitter:card" content="summary">`),
    },
    // A page is copied with its tags where the head's marker was, and
    // otherwise as it is.
    withPageMeta: {
        replaced: () => {
            const page = [utf8(`<head><title>é</title>${pageMetaMarker}</head><body>`), utf8('more</body>')]
            assertEq(textOf(withPageMeta(tags)(page)), `<head><title>é</title>${tagsText}</head><body>more</body>`)
        },
        // At the very start and the very end of the chunk, too.
        edges: () => {
            assertEq(textOf(withPageMeta(tags)([utf8(pageMetaMarker)])), tagsText)
            assertEq(textOf(withPageMeta(tags)([utf8(`x${pageMetaMarker}`)])), `x${tagsText}`)
        },
        // Only the first, the head's: a doc comment's copy of it is content.
        first: () => assertEq(
            textOf(withPageMeta(tags)([utf8(`${pageMetaMarker}<p>${pageMetaMarker}</p>`)])),
            `${tagsText}<p>${pageMetaMarker}</p>`),
        // Bytes whose hex digits spell the marker's one digit off are not the
        // marker: 03 c2 12 … reads "03c212…", the marker's "3c21…" from the
        // second digit on.
        byteAligned: () => {
            const page = [u8ListToVecMsb([0x03, 0xc2, 0x12, 0xd2, 0xd7, 0x06, 0x16, 0x76, 0x52, 0xd6, 0xd6, 0x57, 0x46, 0x12, 0xd2, 0xd3, 0xe0])]
            assertEq(withPageMeta(tags)(page), page)
        },
        // No marker, as on a redirect page or a page whose head is past the
        // first chunk.
        unchanged: () => {
            const plain = [utf8('<head></head>'), utf8(pageMetaMarker)]
            assertEq(withPageMeta(tags)(plain), plain)
            assertEq(withPageMeta(tags)([]).length, 0)
        },
    },
    rustdocHeader: () => {
        const html = rustdocHeader(local)
        assert(html.startsWith('<header><nav aria-label="Site">'), html)
        assert(html.endsWith('</header>'), html)
        assert(html.includes('<a href="/prs/index.html">PRs</a>'), html)
    },
    rustdocFooter: {
        channels: () => {
            const html = rustdocFooter([{ description: 'Patreon', address: 'https://patreon.com/x' }])
            assert(html.startsWith('<footer data-funding="">Support FunctionalScript: '), html)
            assert(html.includes('<a href="https://patreon.com/x">Patreon'), html)
        },
        none: () => assertEq(rustdocFooter([]), ''),
    },
}
