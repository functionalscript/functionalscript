/**
 * A release file as the spans it denotes: type changelog Markdown, and see
 * what the parser makes of it.
 *
 * **The span list shows each span twice — its kind, and its content rendered
 * as itself.** The kind is what this module answers and the rendering is
 * what the kind means, and a reader who has just typed a backtick wants to
 * see both at once: that the parser called it `code`, and that it reads as
 * code.
 *
 * **The initial text carries every property the parser has**, so a reader
 * meets them before changing anything — including the two that are invisible
 * in a rendering and only show here. A code span in the first entry opens on
 * one line and closes on the next, which is why the block layer joins an
 * entry's lines before the grammar sees them. The second entry holds `[` and
 * `*` inside code, which is why code binds tightest: parse emphasis or a
 * link first and that entry comes apart.
 *
 * **It needs no operations.** Parsing is a pure function of the text, so
 * `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element } from '../html/types.ts'
 * @import { Entry, Inline } from './types.ts'
 */

import { pureOk } from '../../effects/module.f.mjs'
import { tryParse } from './module.f.mjs'

/**
 * One span: the name the parser gave it, then the span rendered as itself.
 *
 * @type {(span: Inline) => Element}
 */
const spanView = span => {
    const kind = span[0]
    if (kind === 'code') { return ['li', ['code', kind], ' ', ['code', span[1]]] }
    if (kind === 'strong') { return ['li', ['code', kind], ' ', ['strong', span[1]]] }
    if (kind === 'em') { return ['li', ['code', kind], ' ', ['em', span[1]]] }
    if (kind === 'link') {
        return ['li', ['code', kind], ' ', ['a', { href: span[2] }, span[1]], ' → ', ['code', span[2]]]
    }
    return ['li', ['code', kind], ' ', span[1]]
}

/** @type {(entry: Entry) => Element} */
const entryView = entry => ['li', ['ul', ...entry.map(spanView)]]

/**
 * The state is the text itself, not the entries: the entries are a function
 * of it, and storing a value the state can already compute is how the two
 * drift apart.
 *
 * The initial text is three entries in the shape `changelog/README.md`
 * prescribes — `Topic: short description`, wrapped, ending in the pull
 * requests they came from. Between them they use every span the grammar has,
 * a reference left as text, a code span across a line break, and both of the
 * symbols that only stay readable because code is recognised first.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = {
    init: [
        '- `fjs/effects`: `match` resolves a command\'s handler with an `own',
        '  property` lookup, so a `command` naming `Object.prototype` throws (#1421)',
        '- **BREAKING CHANGES:** `types/list`: `tryFold` answers `readonly T[]`, and',
        '  the `*` operator is *always* fallible now',
        '- `media/markdown`: the parser this page is a demo of',
        '  [#2166](https://github.com/functionalscript/functionalscript/pull/2166)',
    ].join('\n'),
    update: state => event => pureOk(event.kind === 'input' ? event.value : state),
    view: text => {
        const parsed = tryParse(text)
        return ['div',
            ['p',
                ['label', { for: 'changelog' }, 'A release file '],
                ['textarea', { id: 'changelog', name: 'changelog', rows: '8' }, text],
            ],
            parsed[0] === 'error'
                ? ['p', `Error: ${parsed[1]}`]
                : ['ol', ...parsed[1].map(entryView)],
        ]
    },
}
