/**
 * @import { StringMap } from '../types/object/types.ts'
 * @import { Assert } from '../asserts/types.ts'
 * @import { Equal } from '../types/ts/types.ts'
 * @import { Option, Or, Rest, Type1, Unknown, DemoState } from './types.ts'
 * @import { DemoEvent } from '../website/demo/types.ts'
 */

import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../asserts/module.f.mjs'
import { array, number, open, option, or, record, rest, string, unknown } from './module.f.mjs'
import { _graphOf, _readersOf, demo, examples, lessons, projectSchemas } from './demo.f.mjs'
import { htmlToString } from '../media/html/module.f.mjs'
import { runPure } from '../effects/module.f.mjs'
import { unwrap } from '../types/result/module.f.mjs'
import { _crossings, graphSvg } from '../website/demo/graph/module.f.mjs'

/** @type {StringMap<readonly unknown[]>} */
const tests = {
    undefined: [undefined],
    boolean: [true, false],
    string: ['hello'],
    number: [3],
    bigint: [4n],
    object: [null, {}, []],
    function: [() => undefined]
}

// `or`, `array`, `record`, `rest` and `open` take `const` type parameters, so
// a literal written at the call site stays a literal: `or(42, string)`
// describes `42 | string`, not `number | string`. Without the modifier a caller
// has to pin every literal with an `@type {const}` cast, and the assertions
// below are what fail if one of the modifiers is dropped. Each is paired with
// the thunk's own output, so the schema a call *builds* is checked next to the
// type it is given.
const constInference = () => {
    const orConst = or(42, string)
    /** @typedef {Assert<Equal<typeof orConst, Or<readonly [42, typeof string]>>>} _OrConst */
    assertStructurallySame(orConst(), ['or', 42, string])

    // `option` is nullary — absence itself, not a wrapper — so the spelling
    // under test is the union that carries it.
    const optionUnion = or(option, [42, string])
    /** @typedef {Assert<Equal<typeof option, Option>>} _OptionNullary */
    /** @typedef {Assert<Equal<typeof optionUnion, Or<readonly [Option, readonly [42, typeof string]]>>>} _OptionUnion */
    assertStructurallySame(option(), ['option'])
    assertStructurallySame(optionUnion(), ['or', option, [42, string]])

    const arrayConst = array('hello')
    /** @typedef {Assert<Equal<typeof arrayConst, Type1<'array', 'hello'>>>} _ArrayConst */
    assertStructurallySame(arrayConst(), ['array', 'hello'])

    const recordConst = record({ a: number })
    /** @typedef {Assert<Equal<typeof recordConst, Type1<'record', { readonly a: typeof number }>>>} _RecordConst */
    assertStructurallySame(recordConst(), ['record', { a: number }])

    const restConst = rest({ a: 42 }, string)
    /** @typedef {Assert<Equal<typeof restConst, Rest<{ readonly a: 42 }, typeof string>>>} _RestConst */
    assertStructurallySame(restConst(), ['rest', { a: 42 }, string])

    // `open` needs the modifier of its own — it is not `rest` partially
    // applied, so dropping it there widens `[42, string]` to `Type[]` while
    // every assertion above still passes.
    const openConst = open([42, string])
    /** @typedef {Assert<Equal<typeof openConst, Rest<readonly [42, typeof string], Unknown>>>} _OpenConst */
    assertStructurallySame(openConst(), ['rest', [42, string], unknown])
}

/** How many times `needle` appears in `text`. @type {(text: string, needle: string) => number} */
const occurrences = (text, needle) => text.split(needle).length - 1

/** The demo's state after `event`. @type {(event: DemoEvent) => (state: DemoState) => DemoState} */
const step = event => state => unwrap(assertNotNullish(
    runPure(demo.update(state)(event))[0],
    'expected the demo to reach a state without asking for an operation'))

/** The example named `name`. @type {(name: string) => import('./types.ts').DemoExample} */
const exampleNamed = name => assertNotNullish(examples.find(e => e.name === name))

/** The page for `example`, showing schema `shown`, with its own value. @type {(name: string, shown?: 0 | 1) => string} */
const page = (name, shown = 0) => htmlToString(demo.view({ example: name, shown, text: exampleNamed(name).value }))

/**
 * The two readers' lines, or the parser's error.
 *
 * @type {(r: ReturnType<ReturnType<typeof _readersOf>>) => unknown}
 */
const texts = r => 'error' in r ? r : { parse: r.parse.text, validate: r.validate.text }

/**
 * One schema of a pair as the demo draws it: a choice button holding a radio
 * dot and the schema's code, pressed when it is the one picked.
 *
 * @type {(i: number, pressed: boolean, source: string) => string}
 */
const choice = (i, pressed, source) =>
    `<button type="button" name="schema-${i}" aria-pressed="${pressed}"><span data-pick-dot=""></span><span data-pick-code="">${source}</span></button>`

/** A schema's graph as SVG text. @type {(schema: import('./types.ts').Type) => string} */
const svg = schema => htmlToString(graphSvg(_graphOf(schema)))

const demoProof = /** @type {const} */ ({
    // The demo opens on the first example's first schema and its value.
    init: () => {
        assertEq(demo.init.example, examples[0]?.name)
        assertEq(demo.init.shown, 0)
        assertEq(demo.init.text, examples[0]?.value)
    },
    update: {
        // Picking an example shows its first schema and its value.
        pick: () => {
            const s = step({ kind: 'input', name: 'example', value: 'Dictionary' })({ example: 'Closed vs open', shown: 1, text: 'x' })
            assertEq(s.example, 'Dictionary')
            assertEq(s.shown, 0)
            assertEq(s.text, 'export default {"apples":3,"pears":5};')
        },
        // Typing replaces the text and keeps the schema.
        type: () => {
            const s = step({ kind: 'input', name: 'value', value: '[]' })({ ...demo.init, shown: 1 })
            assertEq(s.text, '[]')
            assertEq(s.shown, 1)
        },
        // Flipping between a pair's schemas keeps the value as typed.
        flip: () => {
            const b = step({ kind: 'click', name: 'schema-1' })({ ...demo.init, text: 'typed' })
            assertEq(b.shown, 1)
            assertEq(b.text, 'typed')
            assertEq(step({ kind: 'click', name: 'schema-0' })(b).shown, 0)
        },
        // Any other event leaves the state alone.
        other: () => {
            assertEq(step({ kind: 'start' })(demo.init), demo.init)
            assertEq(step({ kind: 'click', name: 'run' })(demo.init), demo.init)
        },
        // An example no one has is refused, not answered with a plausible page.
        throw: () => step({ kind: 'input', name: 'example', value: 'nope' })(demo.init),
    },
    // The module comment and the README count the examples — seven lessons,
    // three single and four pairs, and fourteen project schemas — so a change
    // to either list fails here and points at the two places that say it.
    counts: () => {
        assertEq(lessons.length, 7)
        assertEq(lessons.filter(e => e.schemas.length === 2).length, 4)
        assertEq(projectSchemas.length, 14)
        assertEq(examples.length, lessons.length + projectSchemas.length)
    },
    // Every project schema's value is one the schema accepts, on both
    // readers: the reader starts from a working document, and a change to a
    // schema that stops accepting it fails here rather than on the page.
    projectValuesAccepted: () => {
        for (const e of projectSchemas) {
            const r = _readersOf(e.schemas[0].schema)(e.value)
            assert(!('error' in r) && r.parse.ok && r.validate.ok, `${e.name}: ${JSON.stringify(r)}`)
        }
    },
    view: {
        // Every example lists in the drop-down, the picked one selected, the
        // lessons and the project's schemas in a group each.
        picker: () => {
            const html = page('Recursion')
            for (const e of examples) { assert(html.includes(`>${e.name}</option>`), e.name) }
            assert(html.includes('<option value="Recursion" selected="">'), html)
            assert(html.includes('<optgroup label="Lessons"><option value="Closed vs open">'), html)
            assert(html.includes('<optgroup label="Used in this project"><option value="JSON-RPC request">'), html)
        },
        // A project schema shows where it comes from as the import a user of
        // the package writes, its module specifier a link to the module's
        // page.
        projectSource: () => {
            const html = page('Note')
            assert(html.includes(`<pre data-code="">import { noteSchema } from <a href="/fjs/media/note/index.html">'functionalscript/fjs/media/note/module.f.mjs'</a></pre>`), html)
        },
        // A pair shows both schemas, each its code as a choice, and marks the
        // one picked; picking the other moves the mark and nothing else.
        pair: () => {
            const a = page('Closed vs open')
            assert(a.includes(`<div data-pick="">${choice(0, true, '{ name: string, age: number }')}${choice(1, false, 'open({ name: string, age: number })')}</div>`), a)
            assert(!a.includes('data-code'), a)
            const b = page('Closed vs open', 1)
            assert(b.includes(`${choice(0, false, '{ name: string, age: number }')}${choice(1, true, 'open({ name: string, age: number })')}`), b)
        },
        // Each answer's verdict is on its label line, and its block — marked
        // for the stylesheet to colour — holds only the value or the failure:
        // red where the closed schema refuses the extra key, green where
        // `open` admits it.
        verdict: () => {
            const a = page('Closed vs open')
            assert(a.includes('<p>parse · error</p><pre data-result="error">at the root: unexpected value</pre>'), a)
            assert(a.includes('<p>validate · error</p>'), a)
            assert(!a.includes('data-result="ok"'), a)
            const b = page('Closed vs open', 1)
            assert(b.includes('<p>parse · ok</p><pre data-result="ok">export default {'), b)
            assert(b.includes('<p>validate · ok</p>'), b)
            assert(!b.includes('data-result="error"'), b)
        },
        // The page reads schema, then its graph, then the value and the
        // answers: the graph is a picture of the schema, and the answers are
        // what typing changes, so each sits by what it belongs to.
        order: () => {
            const html = page('Closed vs open', 1)
            const at = (/** @type {string} */ needle) => {
                const i = html.indexOf(needle)
                assert(i >= 0, needle)
                return i
            }
            assert(at('data-pick=""') < at('<svg'), html)
            assert(at('<svg') < at('<textarea'), html)
            assert(at('<textarea') < at('data-result='), html)
        },
        // A single schema is a code block with no choice, whatever `shown` says.
        single: () => {
            const html = page('Dictionary', 1)
            assert(!html.includes('data-pick'), html)
            assert(html.includes('<pre data-code="">record(number)</pre>'), html)
        },
        // Text that is not a DataJS document is reported, and the readers do
        // not run. Bare JSON is not one: at the top of a module, `{` opens a
        // block.
        notADocument: () => {
            const html = htmlToString(demo.view({ ...demo.init, text: '{"a":1}' }))
            assert(html.includes('<p>DataJS · error</p><pre data-result="error">'), html)
            assert(!html.includes('parse ·'), html)
        },
        // Every example draws every one of its schemas, and no edge passes
        // through a box.
        draw: () => {
            for (const e of examples) {
                for (const s of e.schemas) { assertEq(_crossings(_graphOf(s.schema)), 0) }
            }
        },
    },
    readers: {
        // `parse` builds only what the schema declares; `validate` hands back
        // the value it was given.
        open: () => {
            const r = _readersOf(open({ a: number }))('export default {"a":1,"b":2};')
            assertEq(JSON.stringify(texts(r)), JSON.stringify({ parse: 'export default {"a":1};', validate: 'export default {"a":1,"b":2};' }))
        },
        // The value is DataJS so a schema's every value can be typed:
        // `undefined` is what tells the two schemas of "Absent vs undefined"
        // apart, and JSON cannot write it.
        undefined: () => {
            const [a, b] = exampleNamed('Absent vs undefined').schemas
            const text = /** @type {const} */ ('export default {"a":undefined};')
            assertEq(JSON.stringify(texts(_readersOf(a.schema)(text))),
                JSON.stringify({ parse: 'at a: no match', validate: 'at a: no match' }))
            assertEq(JSON.stringify(texts(_readersOf(assertNotNullish(b).schema)(text))),
                JSON.stringify({ parse: 'export default {"a":undefined};', validate: 'export default {"a":undefined};' }))
        },
        // `validate` hands back the value it was given, sharing included;
        // `parse` builds a copy for each use. A document is written one
        // statement per line, so the shared `const` stands above the export.
        sharing: () => {
            const e = exampleNamed('Shared parts')
            const r = _readersOf(e.schemas[0].schema)(e.value)
            assert(!('error' in r), 'expected the readers to run')
            assert('validate' in r && r.validate.text.startsWith('const $0={"street":"1 Main St","city":"Kyiv"};\nexport default {'), JSON.stringify(r))
            assert('parse' in r && !r.parse.text.includes('const'), JSON.stringify(r))
        },
        // A `;` inside a string ends no statement.
        semicolonInAString: () => assertEq(JSON.stringify(texts(_readersOf({ s: string })('export default {"s":";"};'))),
            JSON.stringify({ parse: 'export default {"s":";"};', validate: 'export default {"s":";"};' })),
        // A failure says where, with the root named rather than left blank.
        errors: () => {
            assertEq(JSON.stringify(texts(_readersOf({ a: number })('export default {"a":"x"};'))),
                JSON.stringify({ parse: 'at a: unexpected value', validate: 'at a: unexpected value' }))
            assertEq(JSON.stringify(texts(_readersOf({ a: number })('export default [];'))),
                JSON.stringify({ parse: 'at the root: unexpected value', validate: 'at the root: unexpected value' }))
        },
        notADocument: () => assert('error' in _readersOf(number)('1'), 'expected a parse error'),
    },
    graph: {
        // A sub-schema used twice is one node with two edges into it.
        shared: () => {
            const html = svg(exampleNamed('Shared parts').schemas[0].schema)
            assertEq(occurrences(html, 'data-graph-kind="struct"'), 3)
            assertEq(occurrences(html, 'data-graph-edge=""'), 5)
        },
        // A named root is expanded under its name; its use of itself is a
        // reference by name, drawn inline, so the graph has no cycle.
        recursive: () => {
            const html = svg(exampleNamed('Recursion').schemas[0].schema)
            assert(html.includes('>tree { }<'), html)
            assert(html.includes('data-graph-value-kind="ref">tree<'), html)
        },
        // A named thunk that is not a const is labelled with its name too.
        namedArray: () => {
            /** @type {import('./types.ts').Type} */
            const list = () => ['array', list]
            const html = svg(list)
            assert(html.includes('>list array<'), html)
        },
        // A built-in or a constant draws inline; a root with no port to sit
        // in is one node.
        inline: () => {
            assert(svg([42, 'x', undefined]).includes('>&quot;x&quot;<'), 'string constant')
            assert(svg(string).includes('>string<'), 'built-in root')
            assert(svg(() => ['const', null]).includes('>null<'), 'a const thunk of a primitive')
        },
        // `open` is `rest` with `unknown`; any other rest shows what an extra
        // member must be, and an empty `or` is `never`.
        rest: () => {
            assert(svg(open([number])).includes('>open<'), 'open')
            const html = svg(rest([number], or()))
            assert(html.includes('>rest<'), html)
            assert(html.includes('>extra<'), html)
            assert(html.includes('>never<'), html)
        },
        record: () => assert(svg(record(array(number))).includes('>record<'), 'record'),
    },
})

export const proof = {
    constInference,
    demo: demoProof,
    typeof: Object.fromEntries(Object.entries(tests).map(([k, a]) => [k, assertNotNullish(a).map(v => () => {
        if (typeof v !== k) { throw `typeof ${v} !== ${k}` }
    })])),
}
