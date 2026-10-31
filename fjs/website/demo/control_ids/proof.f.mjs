/** @import { Element } from '../../../media/html/types.ts' */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { occurrences } from '../../../types/string/module.f.js'
import { eventNameMarker, scopeIds, scopeMarker } from './module.f.mjs'

export const proof = /** @type {const} */ ({
    localReferences: () => {
        /** @type {Element} */
        const view = ['div', { title: 'url(#json)', 'data-copy': '<input id="json">' },
            ['label', { for: 'json' }, 'JSON'],
            ['textarea', { id: 'json', name: 'json', list: 'choices', 'aria-describedby': 'help\t outside\n\r\f', 'aria-controls': 'outside', 'aria-details': 'help choices' }, 'text'],
            ['datalist', { id: 'choices' }],
            ['span', { id: 'help' }, 'Help'],
            ['input', { list: 'external', name: 'input' }],
            ['a', { href: '#json' }, 'local'],
            ['a', { href: '#documentation' }, 'documentation'],
            ['a', { href: 'https://example.com/#json' }, 'external'],
            ['svg', ['clipPath', { id: 'clip' }],
                ['use', { 'xlink:href': '#clip' }],
                ['g', { 'clip-path': 'url(#clip)', fill: "url('#clip')", style: 'stroke:url("#clip");color:red' }]],
        ]
        const html = htmlToString(scopeIds('a')(view))
        assert(html.includes('for="demo-control:1:a:json"'))
        assert(html.includes('id="demo-control:1:a:json" name="json" list="demo-control:1:a:choices"'))
        assert(html.includes('aria-describedby="demo-control:1:a:help outside"'))
        assert(html.includes('aria-controls="outside"'))
        assert(html.includes('aria-details="demo-control:1:a:help demo-control:1:a:choices"'))
        assert(html.includes('list="external"'))
        assert(html.includes('href="#demo-control:1:a:json"'))
        assert(html.includes('href="#documentation"'))
        assert(html.includes('href="https://example.com/#json"'))
        assert(html.includes('xlink:href="#demo-control:1:a:clip"'))
        assert(html.includes('clip-path="url(#demo-control:1:a:clip)"'))
        assert(html.includes("fill=\"url('#demo-control:1:a:clip')\""))
        assert(html.includes('stroke:url(&quot;#demo-control:1:a:clip&quot;)'))
        assert(html.includes('title="url(#json)"'))
        assert(html.includes('data-copy="&lt;input id=&quot;json&quot;&gt;"'))
    },
    radiosAndEvents: () => {
        const scoped = scopeIds('one')
        assertEq(scopeMarker, 'data-demo-scope')
        assertEq(eventNameMarker, 'data-demo-event-name')
        const html = htmlToString(scoped(['div',
            ['input', { type: 'radio', id: 'x', name: 'mode', value: 'x' }],
            ['input', { type: 'radio', id: 'y', name: 'mode', value: 'y', checked: '' }],
            ['input', { type: 'radio' }],
            ['input', { type: 'text', name: 'text' }],
            ['button', { name: 'run' }, 'Run'],
        ]))
        assertEq(occurrences('name="demo-control:3:one:mode"')(html), 2)
        assertEq(occurrences('data-demo-event-name="mode"')(html), 2)
        assert(html.includes('<input type="radio">'))
        assert(html.includes('type="text" name="text"'))
        assert(html.includes('name="run"'))
    },
    caseInsensitiveRadios: () => {
        /** @type {Element} */
        const view = ['div',
            ['INPUT', { type: 'Radio', name: 'mode', value: 'x' }],
            ['Input', { type: 'RADIO', name: 'mode', value: 'y' }],
            ['INPUT', { name: 'text' }],
        ]
        const first = htmlToString(scopeIds('first')(view))
        const second = htmlToString(scopeIds('second')(view))
        assertEq(occurrences('name="demo-control:5:first:mode"')(first), 2)
        assertEq(occurrences('name="demo-control:6:second:mode"')(second), 2)
        assertEq(occurrences('data-demo-event-name="mode"')(first), 2)
        assert(first.includes('name="text"'))
        assert(!first.includes(' name="mode"'))
        assert(!second.includes(' name="mode"'))
    },
    instancesAndViews: () => {
        /** @type {Element} */
        const initial = ['input', { id: 'same', name: 'same' }]
        const first = scopeIds('first')
        const second = scopeIds('second')
        assert(htmlToString(first(initial)) !== htmlToString(second(initial)))
        assertStructurallySame(first(initial), first(initial))
        const later = htmlToString(first(['div', ['label', { for: 'next' }, 'Next'], ['input', { id: 'next', name: 'next' }]]))
        assert(later.includes('for="demo-control:5:first:next"'))
        assert(later.includes('id="demo-control:5:first:next" name="next"'))
        const left = htmlToString(scopeIds('a:b')(['input', { id: 'c' }]))
        const right = htmlToString(scopeIds('a')(['input', { id: 'b:c' }]))
        assert(left !== right)
        assertStructurallySame(first(['p', 'no controls']), ['p', {}, 'no controls'])
    },
})
