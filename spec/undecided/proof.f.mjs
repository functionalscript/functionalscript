/**
 * Proofs for the undecided constructs' page, against registers written
 * here: the page reads the real one in the browser.
 *
 * @import { Effect } from '../../fjs/effects/types.ts'
 * @import { FetchText } from '../../fjs/effects/browser/types.ts'
 * @import { MemOperationMap } from '../../fjs/effects/mock/types.ts'
 * @import { StringMap } from '../../fjs/types/object/types.ts'
 * @import { State } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../fjs/asserts/module.f.js'
import { ioError } from '../../fjs/effects/module.f.mjs'
import { run } from '../../fjs/effects/mock/module.f.mjs'
import { htmlToString } from '../../fjs/media/html/module.f.mjs'
import { error, ok } from '../../fjs/types/result/module.f.js'
import { demo, init, openRows, registerPath, related, strays, undecidedDemo, verdict } from './demo.f.mjs'
import { samples } from './samples.f.mjs'

/**
 * Where and why `fjs compile` refuses each sample, after the file name: the
 * line it prints, which a refusal that moves, or changes its message, fails.
 *
 * @type {StringMap<string>}
 */
const refusals = {
    'lex.trivia': '1:15-2:1 - error: unexpected token',
    'op.comma': '1:26 - error: unexpected token',
    'op.delete': '2:23 - error: unexpected token',
    'op.void': '1:21 - error: unexpected token',
    'op.arguments': '1:23 - error: reserved word',
    'op.unary-plus': '1:16 - error: unexpected token',
    'op.import-call': '1:16 - error: reserved word',
    'op.import-meta': '1:16 - error: reserved word',
    'op.tagged-template': '2:19 - error: unexpected token',
    'acc.property-assignment': '1:22 - error: unexpected token',
    'name.forward-reference': '1:17 - error: const not found',
    'st.for-in-of': '1:42 - error: unexpected token',
    'st.do-while': '1:30 - error: unexpected token',
    'st.try': '1:19 - error: unexpected token',
    'st.debugger': '1:19 - error: unexpected token',
    'st.label': '1:31 - error: unexpected token',
    'st.directive': '1:1 - error: unexpected token',
    'st.literal-call': '1:19 - error: unexpected token',
    'decl.function': '1:1 - error: unexpected token',
    'decl.generator': '1:1 - error: unexpected token',
    'decl.accessor': '1:22 - error: unexpected token',
    'decl.method': '1:19 - error: unexpected token',
    'decl.pattern-object-rest': '1:12 - error: rest element not supported',
    'decl.pattern-computed-key': '2:10 - error: computed key in a binding pattern not supported',
    'mod.export-list': '2:8 - error: unexpected token',
    'mod.reexport': '1:8 - error: unexpected token',
    'mod.side-effect-import': '1:8 - error: unexpected token',
    'mod.string-import-name': '1:10 - error: unexpected token',
    'mod.top-level-await': '1:22 - error: unexpected token',
    'lit.octal': '1:17 - error: unexpected token',
    'lit.trailing-dot': '1:18 - error: unexpected token',
    'lit.string-escape': '1:16-2:1 - error: unexpected token',
    'lit.string-continuation': '1:16-3:1 - error: unexpected token',
    'lit.template-escape': '1:16 - error: unexpected token',
}

/** A register of one row of each **Why**, and a table that is no register's. */
const register = [
    '## Refused Constructs',
    '',
    '| ID | Construct | Why |',
    '|---|---|---|',
    '| `op.in` | `"a" in o` | design ([in](./2346-in-operator.md)) |',
    '| `op.void` | `void 0` | open |',
    '| `st.try` | `try`, `catch` | open (related: [promise](./3380-promise.md)) |',
    '| `op.new` | `new Map()` | planned ([mutability](../design/mutability.md)) |',
    '| `zz.none` | **`zz`** | open ([out](../../../out.md)) |',
    '| `zz.ok` | `zz` | open |',
    '',
    '| Not | a register |',
    '|---|---|',
    '| `x` | open |',
    '',
].join('\n')

/** Samples for the register above: refused, accepted, and one for no open row. */
const written = {
    'op.void': 'export default void 0;\n',
    'st.try': samples['st.try'],
    'zz.ok': 'export default 1;\n',
    'op.in': 'export default "a" in {};\n',
}

const page = undecidedDemo(written)

/** @type {(text: string) => State} */
const loaded = text => ({ register: ok(text) })

/** @type {(state: State) => string} */
const shown = state => htmlToString(page.view(state))

/** @type {(files: StringMap<string>) => MemOperationMap<FetchText, null>} */
const fetching = files => ({
    fetchText: path => s => {
        const text = files[path]
        return [s, text === undefined ? error(ioError({ message: `${path}: HTTP 404` })) : ok(text)]
    },
})

/** @type {(files: StringMap<string>) => (effect: Effect<FetchText, State, never>) => State} */
const perform = files => effect => {
    const [, result] = run(fetching(files))(null)(effect)
    assert(result[0] === 'ok')
    return result[1]
}

export const proof = {
    // Every sample is refused today, where and as `refusals` says: each pins
    // the refusal of its row (spec/todo/refused-constructs.md), by the row's ID.
    refused: () => {
        assertEq(Object.keys(refusals).join(), Object.keys(samples).join())
        for (const [id, sample] of Object.entries(samples)) {
            const v = verdict(id, sample)
            assert(v[0] === 'refused', id)
            assertEq(v[1].split('\n')[0], `${id}.mjs:${refusals[id]}`)
        }
    },
    openRows: () => {
        const rows = openRows(register)
        assert(rows[0] === 'ok')
        assertEq(rows[1].map(row => row.id).join(), 'op.void,st.try,zz.none,zz.ok')
        assertStructurallySame(rows[1][1].related, [['text', 'related: '], ['link', [['text', 'promise']], './3380-promise.md']])
        assertEq(rows[1][0].related.length, 0)
        const refused = openRows('<div>raw</div>\n')
        assert(refused[0] === 'error')
        assertEq(refused[1], `${registerPath} is not read here: line 1: raw HTML`)
    },
    related: () => {
        assertStructurallySame(related([['text', 'open (no record plans it)']]), [['text', 'no record plans it']])
        assertStructurallySame(related([['text', 'open, for now']]), [['text', 'open, for now']])
        assertStructurallySame(related([['text', 'open for now']]), [['text', 'for now']])
        assertStructurallySame(related([['text', 'open (see '], ['code', 'x']]), [['text', 'see '], ['code', 'x']])
        assertStructurallySame(related([['text', 'open ('], ['code', 'x'], ['text', ')']]), [['code', 'x']])
        assertStructurallySame(related([['code', 'open']]), [['code', 'open']])
        assertStructurallySame(related([]), [])
    },
    verdict: () => {
        assertEq(verdict('x', undefined)[0], 'missing')
        assertEq(verdict('x', 'export default 1;\n')[0], 'accepted')
        // an import is resolved: the dependency beside the sample is there
        assertEq(verdict('x', 'import a, { x } from "./a.f.js";\nexport default [a, x];\n')[0], 'accepted')
    },
    strays: () => {
        const rows = openRows(register)
        assert(rows[0] === 'ok')
        assertEq(strays(written)(rows[1]).join(), 'op.in')
        assertEq(strays({ 'op.void': '' })(rows[1]).join(), '')
    },
    view: () => {
        assert(shown(init).includes('Loading…'))
        const text = shown(loaded(register))
        assert(text.includes('<strong>Not decided yet</strong>'), text)
        assert(text.includes('4 open rows: 2 refused today, 1 accepted, 1 without a sample.'), text)
        assert(text.includes('<section id="st.try"'), text)
        assert(text.includes('Accepted now: the row is out of date.'), text)
        assert(text.includes('No sample yet.'), text)
        assert(text.includes('Samples for rows that are no longer open: op.in.'), text)
        // a link the page cannot resolve leaves the cell's words
        assert(text.includes('<strong>Related: </strong>out</div>'), text)
        assert(text.includes('<a href="/spec/todo/3380-promise.md">promise</a>'), text)
        const readmes = shown(loaded(register.replace('open (related: [promise](./3380-promise.md))', 'open ([register](./README.md), [nested](./blocked/README.md), [spec](../README.md))')))
        assert(readmes.includes('<a href="/spec/todo/README.md">register</a>'), readmes)
        assert(readmes.includes('<a href="/spec/todo/blocked/README.md">nested</a>'), readmes)
        assert(readmes.includes('<a href="/spec/index.html">spec</a>'), readmes)
        assert(!text.includes('id="op.in"'), text)
        assert(shown(loaded('<div>a</div>\n')).includes('is not read here'))
        assert(!htmlToString(undecidedDemo({}).view(loaded(register))).includes('no longer open'))
        assert(htmlToString(demo.view(loaded(''))).includes('Samples for rows that are no longer open: lex.trivia,'))
    },
    update: () => {
        const files = { [`/${registerPath}`]: register }
        assertStructurallySame(perform(files)(page.update(init)({ kind: 'start' })), loaded(register))
        assertStructurallySame(perform({})(page.update(init)({ kind: 'start' })), { register: error(`/${registerPath}: HTTP 404`) })
        assertStructurallySame(perform(files)(page.update(init)({ kind: 'click', name: 'x' })), init)
    },
}
