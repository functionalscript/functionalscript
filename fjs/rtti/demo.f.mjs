/**
 * A schema, drawn as a graph under its code, and a value as you type it, with
 * what `parse` and `validate` make of the value under it.
 *
 * **A schema is picked, not typed.** It is a JavaScript value built from
 * functions, which no text box can spell, so the reader picks an example and
 * types only the value.
 *
 * **The value is a DataJS document, not JSON.** A schema describes values
 * JSON cannot write — `undefined`, a bigint, `-0`, `NaN` — and a value one
 * schema of a pair accepts has to be typeable, or the pair can show only half
 * its lesson. DataJS also writes sharing, so a reader can see `validate` hand
 * back the shared value it was given while `parse` builds a copy per use. The
 * results are written back as DataJS by the same codec.
 *
 * **One schema, or two where the difference is the lesson.** Most examples
 * show a single schema. A few — closed against open, absent against
 * `undefined` — are pairs. Both schemas are shown, each a block with a
 * radio dot, and the reader picks one while the value stays put, so the one
 * thing that changes is the schema. The schemas' own code tells them apart,
 * so they carry no names.
 *
 * **The graph is the schema as written**, walked by
 * `fjs/website/demo/graph`: a struct or a tuple is a node with a port per
 * member, an `or`, `array`, `record` or `rest` is a node over what it
 * combines, and a built-in or a constant draws inline in its parent's port.
 * One sub-schema used in two places is one node with two incoming edges.
 * **A named thunk is a definition**: it is expanded where it is the root and
 * drawn by its name wherever another schema uses it — which is what keeps a
 * recursive schema, whose thunk reaches itself, a graph the layout can rank.
 *
 * **It needs no operations.** Every part is a pure function of the state, so
 * `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../website/demo/types.ts'
 * @import { Graph, Shape } from '../website/demo/graph/types.ts'
 * @import { Element } from '../media/html/types.ts'
 * @import { Unknown } from '../media/datajs/types.ts'
 * @import { Const, DemoExample, DemoSchema, DemoState, Type, _Answer } from './types.ts'
 */

import { array, boolean, number, open, option, or, record, rest, string, unknown } from './module.f.mjs'
import { structSchemaEntries, tupleSchemaEntries } from './common/module.f.mjs'
import { parse } from './parse/module.f.mjs'
import { validate } from './validate/module.f.mjs'
import { tryParse, trySerialize } from '../media/datajs/module.f.mjs'
import { leafSerialize } from '../media/datajs/serializer/module.f.mjs'
import { unwrap } from '../types/result/module.f.mjs'
import { concat } from '../types/string/module.f.mjs'
import { toArray } from '../types/list/module.f.mjs'
import { graphOf, graphSvg } from '../website/demo/graph/module.f.mjs'
import { pureOk } from '../effects/module.f.mjs'

const person = { name: string, age: number }

const address = { street: string, city: string }

const order = {
    id: number,
    billing: address,
    shipping: address,
    items: array({ sku: string, qty: number }),
    note: or(option, string),
}

/** @type {Type} */
const tree = () => ['const', { value: number, children: array(tree) }]

/**
 * The examples, in the order the drop-down lists them. The pairs come first,
 * because the first thing a reader sees should be a value that one schema
 * accepts and the other refuses.
 *
 * @type {readonly DemoExample[]}
 */
export const examples = [
    {
        name: 'Closed vs open',
        about: 'A struct admits the keys it declares and no others. open() admits any other keys too.',
        schemas: [
            { source: '{ name: string, age: number }', schema: person },
            { source: 'open({ name: string, age: number })', schema: open(person) },
        ],
        value: 'export default {"name":"Alice","age":30,"admin":true};',
    },
    {
        name: 'Absent vs undefined',
        about: 'or(option, t) lets the key be left out. or(t, undefined) needs the key, though its value may be undefined: try export default {"a":undefined};',
        schemas: [
            { source: '{ a: or(option, number) }', schema: { a: or(option, number) } },
            { source: '{ a: or(number, undefined) }', schema: { a: or(number, undefined) } },
        ],
        value: 'export default {};',
    },
    {
        name: 'Tuple vs rest',
        about: 'A tuple is checked by length as well as by member. rest() admits any number of extra elements of one type.',
        schemas: [
            { source: '[number, string]', schema: [number, string] },
            { source: 'rest([number], string)', schema: rest([number], string) },
        ],
        value: 'export default [1,"a","b"];',
    },
    {
        name: 'Two spellings, one set',
        about: 'or(true, false) and boolean are written differently and accept exactly the same values.',
        schemas: [
            { source: 'or(true, false)', schema: or(true, false) },
            { source: 'boolean', schema: boolean },
        ],
        value: 'export default true;',
    },
    {
        name: 'Shared parts',
        about: 'billing and shipping use one address schema, so the graph draws it once. The value shares one address too: validate hands that back, and parse builds a copy for each use.',
        schemas: [{
            source: 'const address = { street: string, city: string }\n'
                + 'const order = {\n'
                + '    id: number,\n'
                + '    billing: address,\n'
                + '    shipping: address,\n'
                + '    items: array({ sku: string, qty: number }),\n'
                + '    note: or(option, string),\n'
                + '}',
            schema: order,
        }],
        value: 'const $home={"street":"1 Main St","city":"Kyiv"};\n'
            + 'export default {"id":7,"billing":$home,"shipping":$home,"items":[{"sku":"A1","qty":2}]};',
    },
    {
        name: 'Dictionary',
        about: 'record(t) admits any string keys, each holding a t.',
        schemas: [{ source: 'record(number)', schema: record(number) }],
        value: 'export default {"apples":3,"pears":5};',
    },
    {
        name: 'Recursion',
        about: 'A schema can use itself. The graph draws that use by its name.',
        schemas: [{ source: "const tree = () => ['const', { value: number, children: array(tree) }]", schema: tree }],
        value: 'export default {"value":1,"children":[{"value":2,"children":[]}]};',
    },
]

/** @type {(name: string) => DemoExample} */
const exampleOf = name => {
    const found = examples.find(e => e.name === name)
    if (found === undefined) { throw 'rtti demo: no example has this name' }
    return found
}

// ── graph ────────────────────────────────────────────────────────────────────

/**
 * A constant schema: a struct or a tuple is a node with a port per declared
 * member; a primitive draws inline, spelled as DataJS spells it.
 *
 * @type {(c: Const) => Shape<Type>}
 */
const constShape = c => c === null || typeof c !== 'object'
    ? { inline: concat(leafSerialize(c)) }
    : c instanceof Array
        ? { kind: 'tuple', label: '[ ]', children: tupleSchemaEntries(c) }
        : { kind: 'struct', label: '{ }', children: structSchemaEntries(c) }

/**
 * What a thunk returns, as a shape, its label led by `name` when the thunk
 * has one. A built-in draws inline; `open(c)` is `rest(c, unknown)` and
 * draws as `open`.
 *
 * @type {(name: string) => (info: ReturnType<Exclude<Type, Const>>) => Shape<Type>}
 */
const infoShape = name => info => {
    /** @type {(label: string) => string} */
    const named = label => name === '' ? label : `${name} ${label}`
    switch (info[0]) {
        case 'const': {
            const s = constShape(info[1])
            return 'inline' in s ? s : { ...s, label: named(s.label) }
        }
        case 'array': { return { kind: 'array', label: named('array'), children: [['item', info[1]]] } }
        case 'record': { return { kind: 'record', label: named('record'), children: [['value', info[1]]] } }
        case 'or': {
            const [, ...members] = info
            return members.length === 0
                ? { inline: 'never' }
                : { kind: 'or', label: named('or'), children: members.map(/** @type {(m: Type) => readonly [string, Type]} */ m => ['|', m]) }
        }
        case 'rest': {
            const [, c, r] = info
            return r === unknown
                ? { kind: 'rest', label: named('open'), children: [['declared', c]] }
                : { kind: 'rest', label: named('rest'), children: [['declared', c], ['extra', r]] }
        }
        default: { return { inline: info[0] } }
    }
}

/**
 * A schema reached from another: an anonymous thunk is what it returns; a
 * named one is a definition, drawn by its name.
 *
 * @type {(t: Type) => Shape<Type>}
 */
const shapeOf = t => typeof t !== 'function' ? constShape(t)
    : t.name === '' ? infoShape('')(t())
        : { inline: t.name, kind: 'ref' }

/**
 * `schema` as a graph. A named root is expanded — it is the definition being
 * shown — through the one `Info` it returns, which nothing else can reach,
 * so every use of the name below it stays a reference.
 *
 * @type {(schema: Type) => Graph}
 */
export const _graphOf = schema => {
    if (typeof schema !== 'function' || schema.name === '') { return graphOf(shapeOf)(schema) }
    const info = schema()
    const root = infoShape(schema.name)(info)
    return graphOf(/** @type {(t: Type) => Shape<Type>} */ (t => t === info ? root : shapeOf(t)))(info)
}

// ── readers ──────────────────────────────────────────────────────────────────

/** @type {(path: readonly (string | number)[]) => string} */
const pathText = path => path.length === 0 ? 'the root' : path.join('.')

/**
 * A value as the DataJS document that denotes it, one statement per line, so
 * a `const` a value shares stands on a line of its own above the
 * `export default` that uses it. The serializer emits each statement's
 * closing `;` as a chunk of its own — a `;` inside a string is part of that
 * string's chunk — so the lines break there.
 *
 * @type {(value: Unknown) => string}
 */
const documentText = value =>
    toArray(unwrap(trySerialize(value))).map(c => c === ';' ? ';\n' : c).join('').trimEnd()

/**
 * One reader's answer: whether it succeeded, and the value it succeeded with
 * or where and why it failed.
 *
 * @type {(r: readonly ['ok', unknown] | readonly ['error', { readonly path: readonly (string | number)[], readonly message: string }]) => _Answer}
 */
const answerOf = r => r[0] === 'ok'
    ? { ok: true, text: documentText(/** @type {Unknown} */ (r[1])) }
    : { ok: false, text: `at ${pathText(r[1].path)}: ${r[1].message}` }

/**
 * What `parse` and `validate` make of `text` against `schema`, or the
 * parser's error when `text` is not a DataJS document.
 *
 * @type {(schema: Type) => (text: string) => { readonly parse: _Answer, readonly validate: _Answer } | { readonly error: string }}
 */
export const _readersOf = schema => text => {
    const document = tryParse(text)
    if (document[0] === 'error') { return { error: document[1] } }
    const value = document[1]
    const s = /** @type {any} */ (schema)
    return { parse: answerOf(parse(s)(value)), validate: answerOf(validate(s)(value)) }
}

// ── view ─────────────────────────────────────────────────────────────────────

/**
 * A reader's answer: its verdict on the label line — `parse · ok`,
 * `validate · error` — and under it a block holding only the value or the
 * failure, marked so the stylesheet colours it green or red. The verdict is
 * a word as well as a colour, and the block holds nothing but what a reader
 * could paste back into the value box.
 *
 * @type {(label: string, ok: boolean, text: string) => readonly Element[]}
 */
const answerView = (label, ok, text) => [
    ['p', `${label} · ${ok ? 'ok' : 'error'}`],
    ['pre', { 'data-result': ok ? 'ok' : 'error' }, text],
]

/** @type {(e: DemoExample, picked: DemoExample) => Element} */
const exampleOption = (e, picked) =>
    ['option', e === picked ? { value: e.name, selected: '' } : { value: e.name }, e.name]

/**
 * One schema of a pair: its code with a radio dot, as a button the reader
 * picks it with, pressed when it is the one shown.
 *
 * @type {(s: DemoSchema, i: 0 | 1, shown: 0 | 1) => Element}
 */
const schemaChoice = (s, i, shown) =>
    ['button', { type: 'button', name: `schema-${i}`, 'aria-pressed': String(i === shown) },
        ['span', { 'data-pick-dot': '' }],
        ['span', { 'data-pick-code': '' }, s.source],
    ]

/**
 * The example's schemas: a single one as a code block, a pair as two choices,
 * both in sight.
 *
 * @type {(e: DemoExample, shown: 0 | 1) => Element}
 */
const schemasView = (e, shown) => e.schemas.length === 1
    ? ['pre', { 'data-code': '' }, e.schemas[0].source]
    : ['div', { 'data-pick': '' }, schemaChoice(e.schemas[0], 0, shown), schemaChoice(e.schemas[1], 1, shown)]

/**
 * The value box and, under it, what the two readers make of the value
 * against `s` — kept together, since the answers are what typing changes.
 *
 * @type {(s: DemoSchema, text: string) => readonly Element[]}
 */
const valueView = (s, text) => {
    const r = _readersOf(s.schema)(text)
    return [
        ['p',
            ['label', { for: 'value' }, 'Value (DataJS) '],
            ['textarea', { id: 'value', name: 'value', rows: '4' }, text],
        ],
        .../** @type {readonly Element[]} */ ('error' in r
            ? answerView('DataJS', false, r.error)
            : [
                ...answerView('parse', r.parse.ok, r.parse.text),
                ...answerView('validate', r.validate.ok, r.validate.text),
            ]),
    ]
}

/**
 * The state is the picked example's name, the schema shown, and the text;
 * everything drawn is a function of the three. Picking an example shows its
 * first schema and its value; picking the other schema of a pair keeps the
 * value as typed.
 *
 * @type {Demo<DemoState, DemoEvent>}
 */
export const demo = {
    init: { example: examples[0].name, shown: 0, text: examples[0].value },
    update: state => event => pureOk(
        event.kind === 'input'
            ? event.name === 'example'
                ? { example: event.value, shown: 0, text: exampleOf(event.value).value }
                : { ...state, text: event.value }
            : event.kind === 'click' && (event.name === 'schema-0' || event.name === 'schema-1')
                ? { ...state, shown: event.name === 'schema-0' ? 0 : 1 }
                : state),
    view: ({ example, shown, text }) => {
        const e = exampleOf(example)
        const [a, b] = e.schemas
        // The schema shown, then its graph — a picture of the schema, so it
        // sits by it and changes with the pick — and the value with its
        // answers last.
        const s = shown === 1 && b !== undefined ? b : a
        return ['div',
            ['p',
                ['label', { for: 'example' }, 'Example '],
                ['select', { id: 'example', name: 'example' }, ...examples.map(x => exampleOption(x, e))],
            ],
            ['p', e.about],
            schemasView(e, shown),
            graphSvg(_graphOf(s.schema)),
            ...valueView(s, text),
        ]
    },
}
