/**
 * A release file as the website publishes it: type changelog Markdown, and
 * see the page a release gets.
 *
 * **What this shows that the parser's own demo cannot** is the half that
 * knows the repository. `fjs/media/markdown` leaves a reference inside a
 * `text` span on purpose, so its demo can only show `(#1807, #1813)` as the
 * characters it is. Here the same characters are the links they name, and
 * the entry is drawn rather than listed — which is the whole of what a
 * reader of the site sees.
 *
 * The initial text carries the four cases the derivation has to tell apart:
 * a single bare reference, a group of three that becomes three links with
 * the commas left between them as text, an entry that was published with a
 * link already written out and keeps it, and a parenthesis that is prose
 * and is left alone. That last one is the rule a half-linked parenthesis
 * would break — a group is all references or none.
 *
 * **It needs no operations.** Parsing and linking are pure functions of the
 * text, so `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../demo/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { Document } from '../../media/markdown/types.ts'
 */

import { pureOk } from '../../effects/module.f.mjs'
import { tryParse } from '../../media/markdown/module.f.mjs'
import { entryNode, linked } from './module.f.mjs'

/**
 * How many references the page shows, and how many of them this module
 * derived rather than found already written out. The difference is the
 * module's whole job, so the demo counts it rather than leaving a reader to
 * spot it.
 *
 * @type {(document: Document) => readonly [derived: number, written: number]}
 */
const counted = document => document.reduce(
    ([derived, written], entry) => {
        const before = entry.filter(span => span[0] === 'link').length
        const after = linked(entry).filter(span => span[0] === 'link').length
        return [derived + after - before, written + before]
    },
    /** @type {readonly [number, number]} */([0, 0]))

/** @type {(n: number, one: string) => string} */
const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`

/**
 * The state is the text itself, not the entries: they are a function of it,
 * and storing a value the state can already compute is how the two drift
 * apart.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = {
    init: [
        "- `fjs/effects`: `match` resolves a command's handler with an own-property",
        '  lookup, so a `command` naming `Object.prototype` throws (#1421)',
        '- **BREAKING CHANGES:** `ci`: jobs share one Nix shell, and `./nix/dev` no',
        '  longer exists — the shell is `nix develop ./nix` (#1807, #1813, #1825)',
        '- `types/list`: `tryFold` is *always* fallible now',
        '  [#1553](https://github.com/functionalscript/functionalscript/pull/1553)',
        '- `media/nix`: an indented string is its parts (e.g. one nobody imports)',
    ].join('\n'),
    update: state => event => pureOk(event.kind === 'input' ? event.value : state),
    view: text => {
        const document = tryParse(text)
        if (document[0] === 'error') {
            return ['div',
                ['p',
                    ['label', { for: 'release' }, 'A release file '],
                    ['textarea', { id: 'release', name: 'release', rows: '9' }, text],
                ],
                ['p', `Error: ${document[1]}`],
            ]
        }
        const [derived, written] = counted(document[1])
        return ['div',
            ['p',
                ['label', { for: 'release' }, 'A release file '],
                ['textarea', { id: 'release', name: 'release', rows: '9' }, text],
            ],
            ['p', [
                plural(document[1].length, 'entry').replace('entrys', 'entries'),
                ` · ${plural(derived, 'reference')} derived`,
                ` · ${plural(written, 'link')} already written out`,
            ].join('')],
            ['ul', ...document[1].map(entry => /** @type {Element} */(entryNode(entry)))],
        ]
    },
}
