/**
 * @import { DemoEvent } from './types.ts'
 */

import { codeMarker, resultMarker, stylesheet } from '../style/module.f.js'
import { textDemo, textField, inputField, fieldUpdate, caption, refusal, radios, dragAxis, dragAxisAttributes, dragValue } from './module.f.mjs'
import { name as exampleName } from './examples/module.f.js'
import { htmlToString } from '../../media/html/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.js'
import { unwrap } from '../../types/result/module.f.js'
import { demo } from './demo.f.mjs'
import { decodeQuery, encodeQuery, restoreInputs } from './sharing/module.f.mjs'

/** A demo that echoes its text after the textarea, twice, as siblings. */
const plain = textDemo({ intro: 'Echo <text> & compare.', name: 'src', label: 'Source', init: 'a' })(text => [['p', text], ['pre', text]])

const picked = textDemo({ intro: 'Echo <text> & compare.', name: 'src', label: 'Source', rows: 3, init: 'one', examples: [['One', 'one', 'one'], ['Two', 'two', 'two']] })(() => [])

/** @type {(demo: typeof plain) => (state: string) => (event: DemoEvent) => string} */
const next = demo => state => event => unwrap(assertNotNullish(
    runPure(demo.update(state)(event))[0],
    'expected the demo to reach a value without asking for an operation'))

export const proof = {
    greetingSharing: () => {
        const sharing = assertNotNullish(demo.sharing)
        assertEq(unwrap(encodeQuery(sharing, sharing.read(demo.init))), '#demo')
        for (const greeting of ['Hello', 'Hi', 'Welcome']) {
            const link = unwrap(encodeQuery(sharing, sharing.read(greeting)))
            const query = unwrap(decodeQuery(link === '#demo' ? '' : link.slice(0, -5)))
            const restored = sharing.restore(unwrap(restoreInputs(sharing, query)))
            assertEq(restored, greeting)
            assert(htmlToString(demo.view(restored)).includes(`<option value="${greeting}" selected="">${greeting}</option>`))
        }
        assertEq(restoreInputs(sharing, unwrap(decodeQuery('?greeting=Goodbye')))[0], 'error')
        assertEq(unwrap(encodeQuery(sharing, sharing.read('Hi'))), '?greeting=Hi#demo')
    },
    widgetsDemo: () => {
        const initial = htmlToString(demo.view(demo.init))
        assert(initial.includes('<option value="Hello" selected="">Hello</option>'))
        assert(initial.includes('name="reset" disabled=""'))
        const greeting = unwrap(assertNotNullish(runPure(demo.update(demo.init)({ kind: 'input', name: 'greeting', value: 'Hi' }))[0]))
        assertEq(greeting, 'Hi')
        const changed = htmlToString(demo.view(greeting))
        assert(changed.includes('<option value="Hi" selected="">Hi</option>'))
        assert(changed.includes('<button type="button" name="reset">Reset</button>'))
        assert(changed.includes('<p>Hi!</p>'))
        assertEq(unwrap(assertNotNullish(runPure(demo.update(greeting)({ kind: 'click', name: 'reset' }))[0])), 'Hello')
        for (const event of /** @type {readonly DemoEvent[]} */ ([{ kind: 'start' }, { kind: 'input', name: 'other', value: 'Welcome' }, { kind: 'click', name: 'other' }])) {
            assertEq(unwrap(assertNotNullish(runPure(demo.update(greeting)(event))[0])), greeting)
        }
    },
    markers: () => {
        assertEq(codeMarker, 'data-code')
        assertEq(resultMarker, 'data-result')
        assert(stylesheet.includes('[data-code], [data-result]'), 'output box selectors')
        assert(stylesheet.includes('[data-result="error"]'), 'refusal verdict selector')
    },
    refusal: () => assertEq(htmlToString(refusal('Unexpected <token> & input\nnext line')),
        '<!DOCTYPE html><div role="status"><p data-caption="">Refused:</p><pre data-result="error">Unexpected &lt;token&gt; &amp; input\nnext line</pre></div>'),
    // Each option's id is the group's name and its value; only the chosen one
    // is checked.
    radios: () => assertEq(htmlToString(radios('side', 'Side', [{ value: 'L', label: 'Left' }, { value: 'R', label: 'Right' }], 'R')),
        '<!DOCTYPE html><fieldset data-radios=""><legend>Side</legend><div><label for="side-L"><input type="radio" id="side-L" name="side" value="L">Left</label><label for="side-R"><input type="radio" id="side-R" name="side" value="R" checked="">Right</label></div></fieldset>'),
    dragAxis: () => {
        const attributes = dragAxis({ min: -1.5, max: 3.5, left: 40, right: 480 })
        assertEq(attributes[dragAxisAttributes.min], '-1.5')
        assertEq(attributes[dragAxisAttributes.max], '3.5')
        assertEq(attributes[dragAxisAttributes.left], '40')
        assertEq(attributes[dragAxisAttributes.right], '480')
    },
    dragValue: {
        // The pointer's x mapped through the axis: the middle of `0..600`
        // is the middle of `-2..4`.
        mapped: () => assertEq(dragValue({ min: -2, max: 4, left: 0, right: 600 }, { min: -2, max: 4 }, 300), '1.000'),
        rounded: () => assertEq(dragValue({ min: 0, max: 1, left: 0, right: 3 }, { min: 0, max: 1 }, 1), '0.333'),
        // Past either end, the slider's own bounds hold, which can be
        // narrower than the axis.
        clampedHigh: () => assertEq(dragValue({ min: -2, max: 4, left: 0, right: 600 }, { min: -1, max: 3 }, 800), '3.000'),
        clampedLow: () => assertEq(dragValue({ min: -2, max: 4, left: 0, right: 600 }, { min: -1, max: 3 }, -50), '-1.000'),
        noAxis: () => {
            assertEq(dragValue({ min: -2, max: 4, left: 10, right: 10 }, { min: -2, max: 4 }, 10), null)
            assertEq(dragValue({ min: -2, max: 4, left: 10, right: 0 }, { min: -2, max: 4 }, 10), null)
        },
    },
    caption: () => assertEq(htmlToString(caption('Hash, hex:')),
        '<!DOCTYPE html><p data-caption="">Hash, hex:</p>'),
    inputField: () => {
        const h = htmlToString(inputField({ name: 'key', label: 'Key' }, 'a"&b'))
        assert(h.includes('<label for="key">Key </label>'), h)
        assert(h.includes('type="text" id="key" name="key" value="a&quot;&amp;b"'), h)
    },
    fieldUpdate: () => {
        const state = { algorithm: 'SHA-256', key: '', text: 'message' }
        /** @type {(event: DemoEvent) => typeof state} */
        const next = event => unwrap(assertNotNullish(runPure(fieldUpdate(state)(event))[0]))
        assertEq(JSON.stringify(next({ kind: 'input', name: 'key', value: 'secret' })), JSON.stringify({ ...state, key: 'secret' }))
        assertEq(next({ kind: 'input', name: 'unknown', value: 'ignored' }), state)
        assertEq(next({ kind: 'input', name: 'toString', value: 'ignored' }), state)
        assertEq(next({ kind: 'start' }), state)
        assertEq(next({ kind: 'click', name: 'key' }), state)
        assertEq(state.key, '')
    },
    textField: () => assertEq(htmlToString(textField({ name: 'text', label: 'Text', rows: 3 }, 'a\nb')),
        '<!DOCTYPE html><p><label for="text">Text </label><textarea id="text" name="text" rows="3">a\nb</textarea></p>'),
    // With `highlight`, the textarea sits under a coloured copy of its text, in
    // a wrapper the stylesheet marks; the copy ends in a zero-width space and
    // is hidden from assistive technology, which reads the textarea.
    textFieldHighlighted: () => assertEq(
        htmlToString(textField({ name: 'text', label: 'Text', highlight: text => [['span', { 'data-token': 'keyword' }, text]] }, 'a\nb')),
        '<!DOCTYPE html><p><label for="text">Text </label><span data-editor=""><span data-mirror="" aria-hidden="true"><span data-token="keyword">a\nb</span>\u200b</span><textarea id="text" name="text" rows="8" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off">a\nb</textarea></span></p>'),
    textDemoHighlighted: () => {
        const h = htmlToString(textDemo({ intro: 'x', name: 'src', label: 'Source', init: '', highlight: text => [text] })(() => []).view('q'))
        assertEq(h.includes('<span data-editor="">'), true)
    },
    init: () => assertEq(plain.init, 'a'),
    view: {
        // The textarea carries `id` and `name`, 8 rows by default, and what
        // `render` answers follows it as siblings, with no drop-down.
        plain: () => {
            const h = htmlToString(plain.view('x'))
            assertEq(h, '<!DOCTYPE html><div><p>Echo &lt;text&gt; &amp; compare.</p><p><label for="src">Source </label><textarea id="src" name="src" rows="8">x</textarea></p><p>x</p><pre>x</pre></div>')
        },
        // With examples, the drop-down is drawn above the textarea, and
        // `rows` is the one given.
        examples: () => {
            const h = htmlToString(picked.view('two'))
            assert(h.startsWith(`<!DOCTYPE html><div><p>Echo &lt;text&gt; &amp; compare.</p><p><label for="${exampleName}">`), h)
            assert(h.includes('<option value="Two" selected="" data-example-id="two">Two</option>'), h)
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
    // Refused where the demo is built.
    throw: {
        // A repeated example.
        repeatedExample: () => textDemo({ intro: 'Echo <text> & compare.', name: 'src', label: 'Source', init: '', examples: [['A', 'a', 'a'], ['A', 'b', 'another-a']] })(() => []),
        // A textarea named like the drop-down: typing would arrive as a pick.
        nameCollision: () => textDemo({ intro: 'Echo <text> & compare.', name: exampleName, label: 'Source', init: '', examples: [['A', 'a', 'a']] })(() => []),
    },
    // Without examples, the drop-down's name is free for the textarea.
    exampleNameWithoutExamples: () => assertEq(
        next(textDemo({ intro: 'Echo <text> & compare.', name: exampleName, label: 'Source', init: '' })(() => []))('')({ kind: 'input', name: exampleName, value: 'typed' }),
        'typed'),
}
