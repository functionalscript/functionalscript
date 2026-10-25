import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { htmlToString } from '../../media/html/module.f.mjs'
import { linkedHeading, permalink, reservedIds } from './module.f.js'

export const proof = /** @type {const} */ ({
    control: () => {
        assertStructurallySame(reservedIds, ['demo', 'emergent-testing', 'directory-drawer', 'drawer-title'])
        const html = htmlToString(permalink('ast', 'AST'))
        assert(html.includes('<a href="#ast" aria-label="Link to AST"><svg '))
        assert(html.includes('hidden="" data-copy-fragment="ast" aria-label="Copy link to AST" title="Copy link"><svg '))
        assertEq(html.split('<svg ').length - 1, 2)
        assertEq(html.split('aria-hidden="true"').length - 1, 2)
        assert(html.includes('<span data-copy-status="" aria-live="polite"></span>'))
        assert(!html.includes('>Copy link<'))
    },
    demoControl: () => {
        const html = htmlToString(permalink('demo', 'Demo', true))
        assert(html.includes('data-copy-demo-section="demo"'))
        assert(html.includes('data-copy-demo=""'))
        assertEq(html.split('<svg ').length - 1, 3)
        assertEq(html.split('data-input-link-dot=""').length - 1, 1)
        assert(html.includes('aria-label="Copy section link" title="Copy section link"'))
        assert(html.includes('aria-label="Copy link with inputs" title="Copy link with inputs"'))
        assert(!html.includes('data-copy-fragment='))
    },
    heading: () => {
        const html = htmlToString(linkedHeading(3, 'a-b', 'A & B', ['A & ', ['code', 'B']]))
        assert(html.startsWith('<!DOCTYPE html><div data-linked-heading=""><h3 id="a-b">A &amp; <code>B</code></h3>'))
        assert(html.includes('aria-label="Copy link to A &amp; B"'))
        assert(html.endsWith('</span></div>'))
    },
})
