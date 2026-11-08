/** @import { Vec } from '../../types/bit_vec/types.ts' */

import { assert, assertEq } from '../../asserts/module.f.js'
import { productionOrigin } from '../origin/module.f.js'
import { cargoDocHref, cargoDocPage, crateHref, crateOf, pageUrlMarker, rustdocHead, rustdocHeadPath, rustdocFooter, rustdocHeader, withPageUrl } from './module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { utf8ToString } from '../../text/utf8/module.f.mjs'
import { u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'

/** A page's chunks as the text they hold together. @type {(chunks: readonly Vec[]) => string} */
const textOf = chunks => chunks.map(utf8ToString).join('')

/** A page's `og:url` on production. */
const url = (/** @type {string} */ href) => `<meta property="og:url" content="${productionOrigin}${href}">`

const local = /** @type {const} */ ({ commit: null, branch: null, funding: [] })

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
    // The head carries the favicons and the card tags every page shares:
    // no title, description or URL, which differ by page, and the root
    // page's card. It ends with the marker the copy puts the URL at.
    rustdocHead: () => {
        assertEq(rustdocHeadPath, '_rustdoc-head.html')
        const icons = '<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" type="image/svg+xml" href="/fjs/website/favicon.svg">'
        const site = '<meta property="og:site_name" content="FunctionalScript"><meta property="og:type" content="website">'
        assertEq(rustdocHead(local), `${icons}${site}<meta name="twitter:card" content="summary">${pageUrlMarker}`)
        assertEq(rustdocHead({ ...local, branch: 'main' }), `${icons}${site}`
            + `<meta property="og:image" content="${productionOrigin}/_card.png">`
            + '<meta property="og:image:alt" content="FunctionalScript">'
            + '<meta name="twitter:card" content="summary_large_image">'
            + pageUrlMarker)
    },
    // A page is copied with its own URL where the head's marker was, and
    // otherwise as it is.
    withPageUrl: {
        replaced: () => {
            const page = [utf8(`<head><title>é</title>${pageUrlMarker}</head><body>`), utf8('more</body>')]
            const copied = withPageUrl(productionOrigin)('/cargo.doc/a/index.html')(page)
            assertEq(textOf(copied), `<head><title>é</title>${url('/cargo.doc/a/index.html')}</head><body>more</body>`)
        },
        // At the very start and the very end of the chunk, too.
        edges: () => {
            assertEq(textOf(withPageUrl(productionOrigin)('/p.html')([utf8(pageUrlMarker)])), url('/p.html'))
            assertEq(textOf(withPageUrl(productionOrigin)('/p.html')([utf8(`x${pageUrlMarker}`)])), `x${url('/p.html')}`)
        },
        // Only the first, the head's: a doc comment's copy of it is content.
        first: () => assertEq(
            textOf(withPageUrl(productionOrigin)('/p.html')([utf8(`${pageUrlMarker}<p>${pageUrlMarker}</p>`)])),
            `${url('/p.html')}<p>${pageUrlMarker}</p>`),
        // Bytes whose hex digits spell the marker's one digit off are not the
        // marker: 03 c2 12 … reads "03c212…", the marker's "3c21…" from the
        // second digit on.
        byteAligned: () => {
            const page = [u8ListToVecMsb([0x03, 0xc2, 0x12, 0xd2, 0xd6, 0xf6, 0x73, 0xa7, 0x57, 0x26, 0xc2, 0xd2, 0xd3, 0xe0])]
            assertEq(withPageUrl(productionOrigin)('/p.html')(page), page)
        },
        unchanged: () => {
            const page = [utf8(`<head>${pageUrlMarker}</head>`)]
            // No origin, no URL: the marker stays, a comment.
            assertEq(withPageUrl(null)('/p.html')(page), page)
            // No marker, as on a redirect page or a page in a later chunk.
            const plain = [utf8('<head></head>'), utf8(pageUrlMarker)]
            assertEq(withPageUrl(productionOrigin)('/p.html')(plain), plain)
            assertEq(withPageUrl(productionOrigin)('/p.html')([]).length, 0)
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
