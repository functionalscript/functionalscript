import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { htmlToString } from '../../media/html/module.f.mjs'
import { linkedHeading, permalink, reservedIds } from './module.f.js'

export const proof = /** @type {const} */ ({
    control: () => {
        assertStructurallySame(reservedIds, ['demo', 'emergent-testing', 'directory-drawer', 'drawer-title'])
        const html = htmlToString(permalink('ast', 'AST'))
        assertEq(html, '<!DOCTYPE html><span data-permalink=""><a href="#ast" aria-label="Link to AST">#</a><button type="button" hidden="" data-copy-fragment="ast" aria-label="Copy link to AST">Copy link<span data-copy-status="" aria-live="polite"></span></button></span>')
    },
    heading: () => {
        const html = htmlToString(linkedHeading(3, 'a-b', 'A & B', ['A & ', ['code', 'B']]))
        assert(html.startsWith('<!DOCTYPE html><div data-linked-heading=""><h3 id="a-b">A &amp; <code>B</code></h3>'))
        assert(html.includes('aria-label="Copy link to A &amp; B"'))
        assert(html.endsWith('</span></div>'))
    },
})
