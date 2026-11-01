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
 * @import { Element, Node } from '../html/types.ts'
 * @import { Emphasised, Entry, Inline, LinkLabel } from './types.ts'
 */

import { textDemo, refusal } from '../../website/demo/module.f.mjs'
import { tryParse } from './module.f.mjs'
import { assertStructurallySame } from '../../asserts/module.f.js'

/**
 * A label's or a body's span as a node: code, a link, or its words.
 *
 * @type {(l: LinkLabel | Emphasised) => Node}
 */
const labelNode = l => l[0] === 'code' ? ['code', l[1]] : l[0] === 'link' ? ['a', { href: l[2] }, ...l[1].map(labelNode)] : l[1]

/**
 * One span: the name the parser gave it, then the span rendered as itself.
 *
 * @type {(span: Inline) => Element}
 */
const spanView = span => {
    const kind = span[0]
    if (kind === 'code') { return ['li', ['code', kind], ' ', ['code', span[1]]] }
    if (kind === 'image') { return ['li', ['code', kind], ' ', span[1], ' → ', ['code', span[2]]] }
    /** @type {readonly Node[]} */
    const label = kind === 'text' ? [] : span[1].map(labelNode)
    if (kind === 'strong') { return ['li', ['code', kind], ' ', ['strong', ...label]] }
    if (kind === 'em') { return ['li', ['code', kind], ' ', ['em', ...label]] }
    if (kind === 'link') {
        return ['li', ['code', kind], ' ', ['a', { href: span[2] }, ...label], ' → ', ['code', span[2]]]
    }
    return ['li', ['code', kind], ' ', span[1]]
}

/** @type {(entry: Entry) => Element} */
const entryView = entry => ['li', ['ul', ...entry.map(spanView)]]

// spanView accepts Inline, including images. Release entries refuse images,
// so prove that part of the renderer's contract directly.
export const proof = /** @type {const} */ ({
    image: () => assertStructurallySame(spanView(['image', 'diagram', 'image.svg']),
        ['li', ['code', 'image'], ' ', 'diagram', ' → ', ['code', 'image.svg']]),
    // A link inside bold is drawn as a link.
    strongLink: () => assertStructurallySame(spanView(['strong', [['text', 'see '], ['link', [['code', 'a']], 'u']]]),
        ['li', ['code', 'strong'], ' ', ['strong', 'see ', ['a', { href: 'u' }, ['code', 'a']]]]),
})

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
export const demo = textDemo({
    intro: 'Parses a changelog release file into Markdown spans. Each span shows its kind and its rendered content, so you can compare what the parser reads with how it looks.',
    name: 'changelog',
    label: 'A release file',
    init: [
        '- `fjs/effects`: `match` resolves a command\'s handler with an `own',
        '  property` lookup, so a `command` naming `Object.prototype` throws (#1421)',
        '- **BREAKING CHANGES:** `types/list`: `tryFold` answers `readonly T[]`, and',
        '  the `*` operator is *always* fallible now',
        '- `media/markdown`: the parser this page is a demo of',
        '  [#2166](https://github.com/functionalscript/functionalscript/pull/2166)',
    ].join('\n'),
})(text => {
    const parsed = tryParse(text)
    return [parsed[0] === 'error'
        ? refusal(parsed[1])
        : ['ol', ...parsed[1].map(entryView)]]
})
