import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { htmlToString } from '../../media/html/module.f.js'
import { occurrences } from '../../types/string/module.f.js'
import { linkedHeading, permalink, reservedIds } from './module.f.js'

export const proof = /** @type {const} */ ({
    control: () => {
        assertStructurallySame(reservedIds, ['demo', 'emergent-testing', 'directory-drawer', 'drawer-title'])
        const html = htmlToString(permalink('ast', 'AST'))
        assert(html.includes('<a href="#ast" aria-label="Link to AST" data-heading-anchor=""><svg '))
        assertEq(occurrences('<svg ')(html), 1)
        assertEq(occurrences('aria-hidden="true"')(html), 1)
        assert(!html.includes('<button'))
    },
    heading: () => {
        const html = htmlToString(linkedHeading(3, 'a-b', 'A & B', ['A & ', ['code', 'B']]))
        assert(html.startsWith('<!DOCTYPE html><div data-linked-heading=""><h3 id="a-b">A &amp; <code>B</code></h3>'))
        assert(html.includes('<a href="#a-b" aria-label="Link to A &amp; B" data-heading-anchor="">'))
        assert(html.endsWith('</span></div>'))
    },
})
