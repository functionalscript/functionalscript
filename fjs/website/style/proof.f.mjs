import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import * as style from './module.f.js'

export const proof = {
    sharedAssetLinks: () => {
        assert(style.stylesheetPath.startsWith('/') && style.stylesheetPath.endsWith('.css'))
        assert(style.logoPath.startsWith('/') && style.logoPath.endsWith('.svg'))
        assertStructurallySame(style.stylesheetLink, ['link', { rel: 'stylesheet', href: style.stylesheetPath }])
        assertStructurallySame(style.faviconLinks, [
            ['link', { rel: 'icon', href: '/favicon.ico', sizes: '32x32' }],
            ['link', { rel: 'icon', type: 'image/svg+xml', href: style.logoPath }],
        ])
    },
    markupMarkersHaveStyles: () => {
        const markers = Object.entries(style).filter(([name]) => name.endsWith('Marker')).map(([, value]) => value)
        assert(markers.length > 0)
        assertEq(new Set(markers).size, markers.length)
        for (const marker of markers) {
            assert(typeof marker === 'string')
            assert(marker.startsWith('data-'))
            assert(style.stylesheet.includes(`[${marker}`))
        }
        for (const kind of ['terminal', 'category', 'nonTerminal']) {
            assert(style.stylesheet.includes(`[${style.railroadBoxMarker}="${kind}"]`))
            assert(style.stylesheet.includes(`[${style.railroadLabelMarker}="${kind}"]`))
        }
    },
    siteAndRustdocShareBothPalettes: () => {
        for (const token of ['--bg', '--text', '--border', '--link', '--pass', '--fail']) {
            const site = style.stylesheet.split(`${token}: `).slice(1).map(rest => rest.split(';')[0])
            const rustdoc = style.rustdocStylesheet.split(`${token}: `).slice(1).map(rest => rest.split(';')[0])
            assertEq(site.length, 2)
            assert(site[0] !== site[1])
            assertStructurallySame(rustdoc, site)
        }
        assert(style.stylesheet.includes('@media (prefers-color-scheme: dark)'))
        assert(style.rustdocStylesheet.includes('@media (prefers-color-scheme: dark)'))
    },
    sharedBarsAndRustdocLayout: () => {
        for (const selector of ['header nav', '[data-site-links]', '[data-build]', 'footer[data-funding]']) {
            assert(style.stylesheet.includes(selector))
            assert(style.rustdocStylesheet.includes(selector))
        }
        assert(style.rustdocStylesheet.includes('body.rustdoc { flex-wrap: wrap }'))
        assert(style.rustdocStylesheet.includes('body.rustdoc > main { flex: 1 1 0; min-width: 0 }'))
        assert(!style.rustdocStylesheet.includes('body {'))
        for (const state of ['passed', 'failed', 'infrastructure-error']) {
            assert(style.stylesheet.includes(`[data-state="${state}"]`))
        }
    },
}
