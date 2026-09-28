/**
 * @import { DemoEvent } from './types.ts'
 */

import { textDemo } from './module.f.mjs'
import { name as exampleName } from './examples/module.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'

/** A demo that echoes its text after the textarea, twice, as siblings. */
const plain = textDemo({ name: 'src', label: 'Source', init: 'a' })(text => [['p', text], ['pre', text]])

const picked = textDemo({ name: 'src', label: 'Source', rows: 3, init: 'one', examples: [['One', 'one'], ['Two', 'two']] })(() => [])

/** @type {(demo: typeof plain) => (state: string) => (event: DemoEvent) => string} */
const next = demo => state => event => unwrap(assertNotNullish(
    runPure(demo.update(state)(event))[0],
    'expected the demo to reach a value without asking for an operation'))

export const proof = {
    init: () => assertEq(plain.init, 'a'),
    view: {
        // The textarea carries `id` and `name`, 8 rows by default, and what
        // `render` answers follows it as siblings, with no drop-down.
        plain: () => {
            const h = htmlToString(plain.view('x'))
            assertEq(h, '<!DOCTYPE html><div><p><label for="src">Source </label><textarea id="src" name="src" rows="8">x</textarea></p><p>x</p><pre>x</pre></div>')
        },
        // With examples, the drop-down is drawn above the textarea, and
        // `rows` is the one given.
        examples: () => {
            const h = htmlToString(picked.view('two'))
            assert(h.startsWith(`<!DOCTYPE html><div><p><label for="${exampleName}">`), h)
            assert(h.includes('<option value="Two" selected="">Two</option>'), h)
            assert(h.endsWith('<textarea id="src" name="src" rows="3">two</textarea></p></div>'), h)
        },
    },
    update: {
        // Typing is the new text; any other event keeps it.
        plain: () => {
            assertEq(next(plain)('a')({ kind: 'input', name: 'src', value: 'b' }), 'b')
            assertEq(next(plain)('a')({ kind: 'start' }), 'a')
        },
        // A pick is its example's source, typing is the new text, and any
        // other event keeps it.
        examples: () => {
            assertEq(next(picked)('x')({ kind: 'input', name: exampleName, value: 'Two' }), 'two')
            assertEq(next(picked)('x')({ kind: 'input', name: 'src', value: 'y' }), 'y')
            assertEq(next(picked)('x')({ kind: 'click', name: 'go' }), 'x')
        },
    },
    // A repeated example is refused where the demo is built.
    throw: () => textDemo({ name: 'src', label: 'Source', init: '', examples: [['A', 'a'], ['A', 'b']] })(() => []),
}
