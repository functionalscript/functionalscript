/**
 * Proofs for the undecided constructs' page, against registers written
 * here: the page reads the real one in the browser.
 *
 * @import { State } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../fjs/asserts/module.f.js'
import { htmlToString } from '../../fjs/media/html/module.f.mjs'
import { ok } from '../../fjs/types/result/module.f.js'
import { demo, openRows, related, strays, verdict } from './demo.f.mjs'
import { samples } from './samples.f.mjs'

/** A register of three rows, one of each **Why**. */
const register = [
    '## Refused Constructs',
    '',
    '| ID | Construct | Why |',
    '|---|---|---|',
    '| `op.in` | `"a" in o` | design ([in](./2346-in-operator.md)) |',
    '| `op.void` | `void 0` | open |',
    '| `st.try` | `try`, `catch` | open (related: [promise](./3380-promise.md)) |',
    '| `op.new` | `new Map()` | planned ([mutability](../design/mutability.md)) |',
    '| `zz.none` | `zz` | open |',
    '',
].join('\n')

/** @type {(text: string) => State} */
const loaded = text => ({ register: ok(text) })

/** @type {(state: State) => string} */
const shown = state => htmlToString(demo.view(state))

export const proof = {
    // Every sample is refused today: each pins the refusal of its row
    // (spec/todo/refused-constructs.md), by the row's ID.
    refused: () => {
        for (const id of Object.keys(samples)) {
            assertEq(verdict(id)[0], 'refused', id)
        }
    },
    openRows: () => {
        const rows = openRows(register)
        assert(rows[0] === 'ok')
        assertEq(rows[1].map(row => row.id).join(), 'op.void,st.try,zz.none')
        assertStructurallySame(rows[1][1].related, [['text', 'related: '], ['link', [['text', 'promise']], './3380-promise.md']])
        assertEq(rows[1][0].related.length, 0)
    },
    related: () => {
        assertStructurallySame(related([['text', 'open (no record plans it)']]), [['text', 'no record plans it']])
        assertStructurallySame(related([['text', 'design']]), [['text', 'design']])
    },
    verdict: () => {
        assertEq(verdict('zz.none')[0], 'missing')
        const v = verdict('op.void')
        assert(v[0] === 'refused')
        assert(v[1].startsWith('op.void.mjs:1:'), v[1])
    },
    strays: () => {
        const rows = openRows(register)
        assert(rows[0] === 'ok')
        const ids = strays(rows[1])
        assert(ids.includes('decl.function'))
        assert(!ids.includes('op.void'))
    },
    view: () => {
        assert(shown(demo.init).includes('Loading…'))
        const page = shown(loaded(register))
        assert(page.includes('<strong>Not decided yet</strong>'), page)
        assert(page.includes('3 open rows: 2 refused today, 0 accepted, 1 without a sample.'), page)
        assert(page.includes('<section id="st.try"'), page)
        assert(page.includes('No sample yet.'), page)
        assert(page.includes('Samples for rows that are no longer open:'), page)
        assert(!page.includes('id="op.in"'), page)
    },
}
