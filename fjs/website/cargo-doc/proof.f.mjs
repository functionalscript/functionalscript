import { assert, assertEq } from '../../asserts/module.f.js'
import { previewImagePath, productionOrigin } from '../page/module.f.mjs'
import { cargoDocHref, cargoDocPage, crateHref, crateOf, rustdocHead, rustdocHeadPath, rustdocFooter, rustdocHeader } from './module.f.mjs'

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
    // no title, description or URL, which differ by page and are rustdoc's.
    rustdocHead: () => {
        assertEq(rustdocHeadPath, '_rustdoc-head.html')
        const icons = '<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" type="image/svg+xml" href="/fjs/website/favicon.svg">'
        const site = '<meta property="og:site_name" content="FunctionalScript"><meta property="og:type" content="website">'
        assertEq(rustdocHead(local), `${icons}${site}<meta name="twitter:card" content="summary">`)
        assertEq(rustdocHead({ ...local, branch: 'main' }), `${icons}${site}`
            + `<meta property="og:image" content="${productionOrigin}${previewImagePath}">`
            + '<meta property="og:image:alt" content="FunctionalScript logo">'
            + '<meta name="twitter:card" content="summary_large_image">')
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
