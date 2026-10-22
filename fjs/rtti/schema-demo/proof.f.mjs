/**
 * The rtti demo's machinery, exercised through the module page's demo
 * ([`../demo.f.mjs`](../demo.f.mjs)), whose examples cover every path a
 * schema, a value and an event can take, and through demos of its own for the
 * paths that one cannot reach.
 *
 * @import { _Answer, DemoState } from '../types.ts'
 * @import { DemoEvent } from '../../website/demo/types.ts'
 */

import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.js'
import { array, number, open, or, record, rest, string } from '../module.f.mjs'
import { demo, examples } from '../demo.f.mjs'
import { _compare, _graphOf, _marked, _outputsOf, _readersOf, schemaDemo } from './module.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'
import { _crossings, graphSvg } from '../../website/demo/graph/module.f.mjs'
import { toText } from '../../text/marked/module.f.mjs'

/** How many times `needle` appears in `text`. @type {(text: string, needle: string) => number} */
const occurrences = (text, needle) => text.split(needle).length - 1

/** The demo's state after `event`. @type {(event: DemoEvent) => (state: DemoState) => DemoState} */
const step = event => state => unwrap(assertNotNullish(
    runPure(demo.update(state)(event))[0],
    'expected the demo to reach a state without asking for an operation'))

/** The example named `name`. @type {(name: string) => import('../types.ts').DemoExample} */
const exampleNamed = name => assertNotNullish(examples.find(e => e.name === name))

/**
 * The page for `example`, showing schema `shown`, compared with the schema
 * keyed `compare` (none by default), with its own value.
 *
 * @type {(name: string, shown?: 0 | 1, compare?: string) => string}
 */
const page = (name, shown = 0, compare = '') =>
    htmlToString(demo.view({ example: name, shown, compare, text: exampleNamed(name).value }))

/**
 * The two readers' lines, or the parser's error.
 *
 * @type {(r: ReturnType<ReturnType<typeof _readersOf>>) => unknown}
 */
const texts = r => 'error' in r ? r : { parse: answerText(r.parse), validate: answerText(r.validate) }

/** A reader's answer as the text its block shows. @type {(a: _Answer) => string} */
const answerText = a => a.ok ? toText(a.marked) : a.text

/** A highlighted run as the demo draws it. @type {(kind: string, text: string) => string} */
const tok = (kind, text) => `<span data-token="${kind}">${text}</span>`

/** The closed schema of "Closed vs open", highlighted. */
const closedCode = `{ ${tok('identifier', 'name')}: ${tok('identifier', 'string')}, ${tok('identifier', 'age')}: ${tok('identifier', 'number')} }`

/** The open schema of "Closed vs open", highlighted. */
const openCode = `${tok('identifier', 'open')}(${closedCode})`

/**
 * One schema of a pair as the demo draws it: a choice button holding a radio
 * dot and the schema's highlighted code, pressed when it is the one picked.
 *
 * @type {(i: number, pressed: boolean, source: string) => string}
 */
const choice = (i, pressed, source) =>
    `<button type="button" name="schema-${i}" aria-pressed="${pressed}"><span data-pick-dot=""></span><span data-pick-code="">${source}</span></button>`

/** A schema's graph as SVG text. @type {(schema: import('../types.ts').Type) => string} */
const svg = schema => htmlToString(graphSvg(_graphOf(schema)))

const demoProof = /** @type {const} */ ({
    // The demo opens on the first example's first schema and its value.
    init: () => {
        assertEq(demo.init.example, examples[0]?.name)
        assertEq(demo.init.shown, 0)
        assertEq(demo.init.compare, 'Closed vs open#1')
        assertEq(demo.init.text, examples[0]?.value)
    },
    update: {
        // Picking an example shows its first schema and its value.
        pick: () => {
            const s = step({ kind: 'input', name: 'example', value: 'Dictionary' })({ example: 'Closed vs open', shown: 1, compare: 'x', text: 'x' })
            assertEq(s.example, 'Dictionary')
            assertEq(s.shown, 0)
            assertEq(s.compare, '')
            assertEq(s.text, 'export default {"apples":3,"pears":5};')
            // A pair is compared with its other schema.
            assertEq(step({ kind: 'input', name: 'example', value: 'Tuple vs rest' })(s).compare, 'Tuple vs rest#1')
        },
        // Picking a schema to compare with keeps everything else.
        compare: () => {
            const s = step({ kind: 'input', name: 'compare', value: 'Dictionary#0' })({ ...demo.init, text: 'typed' })
            assertEq(s.compare, 'Dictionary#0')
            assertEq(s.text, 'typed')
            assertEq(s.example, demo.init.example)
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
            // ... and compares the schema picked with the other one.
            assertEq(b.compare, 'Closed vs open#0')
            const a = step({ kind: 'click', name: 'schema-0' })(b)
            assertEq(a.shown, 0)
            assertEq(a.compare, 'Closed vs open#1')
        },
        // Any other event leaves the state alone.
        other: () => {
            assertEq(step({ kind: 'start' })(demo.init), demo.init)
            assertEq(step({ kind: 'click', name: 'run' })(demo.init), demo.init)
        },
        // An example no one has is refused, not answered with a plausible page.
        throw: () => step({ kind: 'input', name: 'example', value: 'nope' })(demo.init),
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
            assert(html.includes(`<pre data-code="">${tok('keyword', 'import')} { ${tok('identifier', 'noteSchema')} } ${tok('identifier', 'from')} <a href="/fjs/media/note/index.html">'functionalscript/fjs/media/note/module.f.mjs'</a></pre>`), html)
        },
        // A pair shows both schemas, each its code as a choice, and marks the
        // one picked; picking the other moves the mark and nothing else.
        pair: () => {
            const a = page('Closed vs open')
            assert(a.includes(`<div data-pick="">${choice(0, true, closedCode)}${choice(1, false, openCode)}</div>`), a)
            assert(!a.includes('<pre data-code="">{ name'), a)
            const b = page('Closed vs open', 1)
            assert(b.includes(`${choice(0, false, closedCode)}${choice(1, true, openCode)}`), b)
        },
        // Each answer's verdict is on its label line, the word marked for the
        // stylesheet to colour, and its block — a code block marked with the
        // verdict — holds only the value, highlighted, or the failure: red
        // where the closed schema refuses the extra key, green where `open`
        // admits it.
        verdict: () => {
            const a = page('Closed vs open')
            assert(a.includes('<p data-caption="">parse · <span data-verdict="error">error</span></p><pre data-code="" data-result="error">at the root: unexpected value</pre>'), a)
            assert(a.includes('<p data-caption="">validate · <span data-verdict="error">error</span></p>'), a)
            assert(!a.includes('data-result="ok"'), a)
            const b = page('Closed vs open', 1)
            assert(b.includes(`<p data-caption="">parse · <span data-verdict="ok">ok</span></p><pre data-code="" data-result="ok">${tok('keyword', 'export')} ${tok('keyword', 'default')} {${tok('string', '&quot;name&quot;')}:`), b)
            assert(b.includes('<p data-caption="">validate · <span data-verdict="ok">ok</span></p>'), b)
            assert(!b.includes('data-result="error"'), b)
        },
        // The page reads schema, then its graph, then the value and the
        // answers: the graph is a picture of the schema, and the answers are
        // what typing changes, so each sits by what it belongs to.
        // The value is typed into a highlighted field: a textarea over a
        // coloured copy of its text.
        valueField: () => {
            const html = htmlToString(demo.view({ ...demo.init, text: 'export default {"a":1};' }))
            assert(html.includes(`<span data-mirror="" aria-hidden="true">${tok('keyword', 'export')} ${tok('keyword', 'default')} {${tok('string', '&quot;a&quot;')}:${tok('number', '1')}};`), html)
        },
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
            assert(html.includes(`<pre data-code="">${tok('identifier', 'record')}(${tok('identifier', 'number')})</pre>`), html)
        },
        // Text that is not a DataJS document is reported, and the readers do
        // not run. Bare JSON is not one: at the top of a module, `{` opens a
        // block.
        notADocument: () => {
            const html = htmlToString(demo.view({ ...demo.init, text: '{"a":1}' }))
            assert(html.includes('<p data-caption="">DataJS · <span data-verdict="error">error</span></p><pre data-code="" data-result="error">'), html)
            assert(!html.includes('parse ·'), html)
        },
        // Under the graph come the TypeScript type, the JSON Schema and the
        // folded canonical form, then the comparison, then the value.
        outputs: () => {
            const html = page('Dictionary')
            assert(html.includes('<p data-caption="">TypeScript:</p><pre data-code="">{<span data-token="keyword">readonly</span>[<span data-token="identifier">k</span> <span data-token="keyword">in</span> <span data-token="keyword">string</span>]?:<span data-token="keyword">number</span>}</pre>'), html)
            assert(html.includes(`<p data-caption="">JSON Schema:</p><pre data-code="">{${tok('string', '&quot;type&quot;')}:${tok('string', '&quot;object&quot;')},${tok('string', '&quot;additionalProperties&quot;')}:{${tok('string', '&quot;type&quot;')}:${tok('string', '&quot;number&quot;')}}}</pre>`), html)
            assert(html.includes(`<details><summary>Canonical form (toData)</summary><pre data-code="">${tok('keyword', 'export')} ${tok('keyword', 'default')} [`), html)
            const at = (/** @type {string} */ needle) => html.indexOf(needle)
            assert(at('<svg') < at('<p data-caption="">TypeScript:</p>'), html)
            assert(at('<details>') < at('<label for="compare">'), html)
            assert(at('<label for="compare">') < at('<textarea'), html)
        },
        // The drop-down lists every schema, a pair's under its example's name
        // and its code; with nothing picked there is no verdict.
        compareNothing: () => {
            const html = page('Dictionary')
            assert(html.includes('<option value="" selected="">nothing</option>'), html)
            assert(html.includes('<option value="Closed vs open#1">Closed vs open: open({ name: string, age: number })</option>'), html)
            assert(html.includes('<option value="Note#0">Note</option>'), html)
            assert(!html.includes('subset('), html)
        },
        // A pair's two spellings of one set are one canonical form.
        compareSame: () => {
            const html = page('Two spellings, one set', 0, 'Two spellings, one set#1')
            assert(html.includes('<option value="Two spellings, one set#1" selected="">'), html)
            assert(html.includes('<p>One set: the two schemas have one canonical form.</p><pre data-code="">equal → true\nsubset(this)(that) → true\nsubset(that)(this) → true</pre>'), html)
        },
        // A key no schema has is refused.
        compareUnknown: { throw: () => page('Dictionary', 0, 'nope#0') },
        // When `validate` refuses the value, the value is written again with
        // the failing member marked; when it accepts, nothing is.
        where: () => {
            const a = page('Closed vs open')
            assert(a.includes('<p data-caption="">Where:</p><pre data-code=""><mark>{&quot;name&quot;:&quot;Alice&quot;,&quot;age&quot;:30,&quot;admin&quot;:true}</mark></pre>'), a)
            assert(!page('Closed vs open', 1).includes('<p data-caption="">Where:</p>'), 'no failure, no mark')
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
            assert('validate' in r && answerText(r.validate).startsWith('const $0={"street":"1 Main St","city":"Kyiv"};\nexport default {'), JSON.stringify(r))
            assert('parse' in r && !answerText(r.parse).includes('const'), JSON.stringify(r))
            // The shared value's name is marked as a name, by the writer.
            assert('validate' in r && r.validate.ok && r.validate.marked.some(([t, k]) => t === '$0' && k === 'identifier'), JSON.stringify(r))
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
    // Every schema the demo shows has a TypeScript type, a JSON Schema and a
    // canonical form, so the outputs never fail on a page.
    outputs: {
        all: () => {
            for (const e of examples) {
                for (const x of e.schemas) {
                    const o = _outputsOf(x.schema)
                    assert(toText(o.ts) !== '' && toText(o.jsonSchema) !== '' && toText(o.data) !== '', e.name)
                }
            }
        },
        // A recursive schema prints its definition as a `type` alias first.
        recursive: () => {
            const o = _outputsOf(exampleNamed('Recursion').schemas[0].schema)
            assertEq(toText(o.ts), 'type tree = {readonly"children":readonly(tree)[],readonly"value":number}\ntree')
            assert(toText(o.jsonSchema).includes('"$defs":{"tree":'), JSON.stringify(o.jsonSchema))
            // the alias is marked: `type` a keyword, its name an identifier
            assertEq(JSON.stringify(o.ts.slice(0, 3)), JSON.stringify([['type', 'keyword'], [' '], ['tree', 'identifier']]))
        },
    },
    // The comparison's five verdicts.
    compare: {
        same: () => assertEq(_compare(or(true, false), or(false, true)).verdict, 'One set: the two schemas have one canonical form.'),
        // Two recursive schemas that differ only in their names: one set,
        // two canonical forms, which `subset` sees through and `equal` does not.
        spelled: () => {
            /** @type {import('../types.ts').Type} */
            const a = () => ['array', a]
            /** @type {import('../types.ts').Type} */
            const b = () => ['array', b]
            const c = _compare(a, b)
            assertEq(c.verdict, 'One set, spelled two ways: each schema includes the other.')
            assertEq(c.calls, 'equal → false\nsubset(this)(that) → true\nsubset(that)(this) → true')
        },
        included: () => assertEq(_compare({ a: number }, open({ a: number })).verdict, 'Included: every value this schema accepts, that one accepts too.'),
        includes: () => assertEq(_compare(open({ a: number }), { a: number }).verdict, 'Includes: this schema accepts every value that one accepts.'),
        neither: () => assertEq(_compare(number, string).verdict, 'Neither is shown to include the other.'),
    },
    // The mark lands on the deepest value the failure's path reaches.
    marked: {
        // A member that fails is marked, in an object or an array, and the
        // rest is written as it is.
        member: () => assertEq(JSON.stringify(_marked(['a', '1'])({ a: [1, 'x', [2]], b: null })),
            JSON.stringify(['{', '"a":', '[', '1', ',', ['mark', '"x"'], ',', '[2]', ']', ',', '"b":', 'null', '}'])),
        // A member that is missing marks the container it is missing from.
        missing: () => assertEq(JSON.stringify(_marked(['b'])({ a: 1 })), JSON.stringify([['mark', '{"a":1}']])),
        // A path that runs past a leaf marks the leaf.
        leaf: () => assertEq(JSON.stringify(_marked(['a', 'b'])({ a: 7n })), JSON.stringify(['{', '"a":', ['mark', '7n'], '}'])),
        // A value that shares much is never expanded past what is shown: a
        // 64-level chain of pairs is 2^64 leaves as one expression, and the
        // mark and the members beside the path are cut, with `…` where.
        shared: () => {
            /** @type {(n: number) => import('../../media/datajs/types.ts').Unknown} */
            const pairs = n => n === 0 ? 'leaf' : (x => [x, x])(pairs(n - 1))
            const nodes = _marked(['0', '1'])(pairs(64))
            // `[[beside,<mark>],beside]`, each part cut at a chunk's end
            // within its limit
            assertEq(nodes.length, 9)
            const beside = nodes[2]
            const mark = nodes[4]
            assert(typeof beside === 'string' && beside.length <= 41 && beside.endsWith('…'), JSON.stringify(beside))
            assertEq(nodes[7], beside)
            assert(typeof mark !== 'string' && mark[0] === 'mark', JSON.stringify(mark))
            const text = mark[1]
            assert(typeof text === 'string' && text.length <= 401 && text.endsWith('…'), JSON.stringify(text))
        },
        // From the page: a nested failure marks only that member.
        page: () => {
            const r = _readersOf({ a: { b: number } })('export default {"a":{"b":"x"}};')
            assert(!('error' in r), 'expected the readers to run')
            assert('validate' in r && !r.validate.ok, JSON.stringify(r))
            assertEq(JSON.stringify(_marked(r.validate.ok ? [] : r.validate.path)(r.value)),
                JSON.stringify(['{', '"a":', '{', '"b":', ['mark', '"x"'], '}', '}']))
        },
    },
    graph: {
        // A sub-schema used twice is one node with two edges into it.
        shared: () => {
            const html = svg(exampleNamed('Shared parts').schemas[0].schema)
            assertEq(occurrences(html, 'data-graph-kind="struct"'), 3)
            assertEq(occurrences(html, 'data-graph-edge=""'), 5)
            // Beside `id`'s value, each edge's row names its target.
            assert(html.includes('data-graph-value-label="" data-graph-value-ref="">{}<'), html)
        },
        // A named root is expanded under its name; its use of itself is a
        // reference by name, drawn inline, so the graph has no cycle.
        recursive: () => {
            const html = svg(exampleNamed('Recursion').schemas[0].schema)
            assert(html.includes('>tree {}<'), html)
            assert(html.includes('data-graph-value-kind="ref">tree<'), html)
        },
        // A named thunk that is not a const is labelled with its name too.
        namedArray: () => {
            /** @type {import('../types.ts').Type} */
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
            const openHtml = svg(open([number]))
            assert(openHtml.includes('>open<'), openHtml)
            assert(!openHtml.includes('>declared<'), openHtml)
            const html = svg(rest([number], or()))
            assert(html.includes('>rest<'), html)
            assert(html.includes('>extra<'), html)
            assert(html.includes('>never<'), html)
        },
        record: () => assert(svg(record(array(number))).includes('>record<'), 'record'),
        // An `array`, a `record` and an `or` name no port: the label says
        // what each member is.
        unkeyed: () => {
            const html = svg(record(array(or(number, [string]))))
            for (const key of ['>value<', '>item<', '>|<']) { assert(!html.includes(key), html) }
            // A tuple's brackets touch, as a struct's do.
            assert(html.includes('data-graph-label="">[]<'), html)
        },
    },
})

/** A demo of one example with one schema. */
const single = schemaDemo([['One', [{ name: 'n', about: 'a number', schemas: [{ source: 'number', schema: number }], value: 'export default 1;' }]]])

export const proof = {
    demo: demoProof,
    // A demo needs an example to open on.
    throw: () => schemaDemo([['None', []]]),
    // With one example and one schema there is nothing to pick: neither the
    // example drop-down nor the comparison is drawn.
    single: () => {
        const html = htmlToString(single.view(single.init))
        assert(!html.includes('name="example"'), html)
        assert(!html.includes('name="compare"'), html)
        assert(html.includes('name="value"'), html)
    },
}
