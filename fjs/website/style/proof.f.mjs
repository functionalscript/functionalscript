import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import {
    stylesheetPath, stylesheetLink, logoPath, faviconLinks, stylesheet, rustdocStylesheet,
    demoMarker, captionMarker, codeMarker, drawingMarker, editorMarker, mirrorMarker,
    resultMarker, verdictMarker, listingMarker, refusedMarker, undecidedMarker, admittedMarker,
    registerRowMarker, powResultMarker, signCardMarker, signExplanationMarker, signFlowMarker,
    signPacketMarker, signRoleMarker, signSchemeMarker, signStageMarker, signStageHeaderMarker,
    signTrustMarker, signTrustKeyMarker, signTrustPathMarker, signVerifierMarker,
    railroadBoxMarker, railroadLabelMarker,
} from './module.f.js'

export const proof = /** @type {const} */ ({
    sharedAssetLinks: () => {
        assert(stylesheetPath.startsWith('/') && stylesheetPath.endsWith('.css'))
        assert(logoPath.startsWith('/') && logoPath.endsWith('.svg'))
        assertStructurallySame(stylesheetLink, ['link', { rel: 'stylesheet', href: stylesheetPath }])
        assertStructurallySame(faviconLinks, [
            ['link', { rel: 'icon', href: '/favicon.ico', sizes: '32x32' }],
            ['link', { rel: 'icon', type: 'image/svg+xml', href: logoPath }],
        ])
    },
    markupMarkersHaveStyles: () => {
        const markers = [
            demoMarker, captionMarker, codeMarker, drawingMarker, editorMarker, mirrorMarker,
            resultMarker, verdictMarker, listingMarker, refusedMarker, undecidedMarker, admittedMarker,
            registerRowMarker, powResultMarker, signCardMarker, signExplanationMarker, signFlowMarker,
            signPacketMarker, signRoleMarker, signSchemeMarker, signStageMarker, signStageHeaderMarker,
            signTrustMarker, signTrustKeyMarker, signTrustPathMarker, signVerifierMarker,
            railroadBoxMarker, railroadLabelMarker,
        ]
        assert(markers.length > 0)
        assertEq(new Set(markers).size, markers.length)
        for (const marker of markers) {
            assert(typeof marker === 'string')
            assert(marker.startsWith('data-'))
            assert(stylesheet.includes(`[${marker}`))
        }
        for (const kind of /** @type {const} */ (['terminal', 'category', 'nonTerminal'])) {
            assert(stylesheet.includes(`[${railroadBoxMarker}="${kind}"]`))
            assert(stylesheet.includes(`[${railroadLabelMarker}="${kind}"]`))
        }
    },
    siteAndRustdocShareBothPalettes: () => {
        for (const token of /** @type {const} */ (['--bg', '--text', '--border', '--link', '--pass', '--fail'])) {
            const site = stylesheet.split(`${token}: `).slice(1).map(rest => rest.split(';')[0])
            const rustdoc = rustdocStylesheet.split(`${token}: `).slice(1).map(rest => rest.split(';')[0])
            assertEq(site.length, 2)
            assert(site[0] !== site[1])
            assertStructurallySame(rustdoc, site)
        }
        assert(stylesheet.includes('@media (prefers-color-scheme: dark)'))
        assert(rustdocStylesheet.includes('@media (prefers-color-scheme: dark)'))
    },
    sharedBarsAndRustdocLayout: () => {
        for (const selector of /** @type {const} */ (['header nav', '[data-site-links]', '[data-build]', 'footer[data-funding]'])) {
            assert(stylesheet.includes(selector))
            assert(rustdocStylesheet.includes(selector))
        }
        assert(rustdocStylesheet.includes('body.rustdoc { flex-wrap: wrap }'))
        assert(rustdocStylesheet.includes('body.rustdoc > main { flex: 1 1 0; min-width: 0 }'))
        assert(!rustdocStylesheet.includes('body {'))
        for (const state of /** @type {const} */ (['passed', 'failed', 'infrastructure-error'])) {
            assert(stylesheet.includes(`[data-state="${state}"]`))
        }
    },
})
