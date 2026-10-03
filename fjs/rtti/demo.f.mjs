/**
 * A schema and a value as you type it: the TypeScript type the schema
 * denotes, what `parse` and `validate` make of the value, and the schema
 * drawn as a graph.
 *
 * **A schema is picked, not typed.** It is a JavaScript value built from
 * functions, which no text box can spell, so the reader picks an example and
 * types only the value.
 *
 * **One schema, or two where the difference is the lesson.** Most examples
 * show a single schema. A few — closed against open, absent against
 * `undefined` — are pairs, and the reader flips between the two while the
 * value stays put, so the one thing that changes is the schema. A pair also
 * shows how the two compare as sets of values (`subset`, `equivalent`),
 * which says nothing about a schema on its own.
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
 * @import { Unknown } from '../media/json/types.ts'
 * @import { Const, DemoExample, DemoSchema, DemoState, Type } from './types.ts'
 */

import { array, boolean, number, open, option, or, record, rest, string, unknown } from './module.f.mjs'
import { structSchemaEntries, tupleSchemaEntries } from './common/module.f.mjs'
import { parse } from './parse/module.f.mjs'
import { validate } from './validate/module.f.mjs'
import { dataToTs } from './ts/module.f.mjs'
import { equivalent, subset, toData } from './data/module.f.mjs'
import { parse as jsonParse, stringify } from '../media/json/module.f.mjs'
import { leafSerialize } from '../media/datajs/serializer/module.f.mjs'
import { sort } from '../types/object/module.f.mjs'
import { concat } from '../types/string/module.f.mjs'
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
        value: '{"name":"Alice","age":30,"admin":true}',
    },
    {
        name: 'Absent vs undefined',
        about: 'or(option, t) lets the key be left out. or(t, undefined) needs the key, though its value may be undefined.',
        schemas: [
            { source: '{ a: or(option, number) }', schema: { a: or(option, number) } },
            { source: '{ a: or(number, undefined) }', schema: { a: or(number, undefined) } },
        ],
        value: '{}',
    },
    {
        name: 'Tuple vs rest',
        about: 'A tuple is checked by length as well as by member. rest() admits any number of extra elements of one type.',
        schemas: [
            { source: '[number, string]', schema: [number, string] },
            { source: 'rest([number], string)', schema: rest([number], string) },
        ],
        value: '[1,"a","b"]',
    },
    {
        name: 'Two spellings, one set',
        about: 'or(true, false) and boolean are written differently and accept exactly the same values.',
        schemas: [
            { source: 'or(true, false)', schema: or(true, false) },
            { source: 'boolean', schema: boolean },
        ],
        value: 'true',
    },
    {
        name: 'Shared parts',
        about: 'billing and shipping use one address schema, so the graph draws it once, with two edges into it.',
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
        value: '{"id":7,"billing":{"street":"1 Main St","city":"Kyiv"},"shipping":{"street":"1 Main St","city":"Kyiv"},"items":[{"sku":"A1","qty":2}]}',
    },
    {
        name: 'Dictionary',
        about: 'record(t) admits any string keys, each holding a t.',
        schemas: [{ source: 'record(number)', schema: record(number) }],
        value: '{"apples":3,"pears":5}',
    },
    {
        name: 'Recursion',
        about: 'A schema can use itself. Its type prints as a named definition, and the graph draws the use by name.',
        schemas: [{ source: "const tree = () => ['const', { value: number, children: array(tree) }]", schema: tree }],
        value: '{"value":1,"children":[{"value":2,"children":[]}]}',
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

/**
 * The TypeScript `schema` denotes, as the runtime printer spells it: the
 * definitions a recursive schema names, then the type itself.
 *
 * @type {(schema: Type) => string}
 */
export const _tsOf = schema => {
    const [definitions, entry] = dataToTs()(toData(schema))
    return [...definitions.map(([n, e]) => `type ${n} = ${e}`), entry].join('\n')
}

/** @type {(path: readonly (string | number)[]) => string} */
const pathText = path => path.length === 0 ? 'the root' : path.join('.')

/**
 * One reader's answer as a line: the value it succeeded with, or where and
 * why it failed.
 *
 * @type {(r: readonly ['ok', unknown] | readonly ['error', { readonly path: readonly (string | number)[], readonly message: string }]) => string}
 */
const resultText = r => r[0] === 'ok'
    ? `ok ${stringify(sort)(/** @type {Unknown} */ (r[1]))}`
    : `error at ${pathText(r[1].path)}: ${r[1].message}`

/**
 * What `parse` and `validate` make of `text` against `schema`, or the JSON
 * error when `text` is not a JSON value.
 *
 * @type {(schema: Type) => (text: string) => { readonly parse: string, readonly validate: string } | { readonly json: string }}
 */
export const _readersOf = schema => text => {
    const json = jsonParse(text)
    if (json[0] === 'error') { return { json: json[1] } }
    const value = json[1]
    const s = /** @type {any} */ (schema)
    return { parse: resultText(parse(s)(value)), validate: resultText(validate(s)(value)) }
}

/**
 * How two schemas compare as sets of values.
 *
 * @type {(a: Type) => (b: Type) => string}
 */
export const _compare = a => b => {
    const da = toData(a)
    const db = toData(b)
    /** @type {(x: boolean) => string} */
    const yes = x => x ? 'yes' : 'no'
    return `A ⊆ B: ${yes(subset(da)(db))}   B ⊆ A: ${yes(subset(db)(da))}   A ≡ B: ${yes(equivalent(da)(db))}`
}

// ── view ─────────────────────────────────────────────────────────────────────

/** @type {(e: DemoExample, picked: DemoExample) => Element} */
const exampleOption = (e, picked) =>
    ['option', e === picked ? { value: e.name, selected: '' } : { value: e.name }, e.name]

/** @type {(i: 0 | 1, shown: 0 | 1) => Element} */
const schemaButton = (i, shown) =>
    ['button', { type: 'button', name: `schema-${i}`, 'aria-pressed': String(i === shown) }, i === 0 ? 'Schema A' : 'Schema B']

/** @type {(e: DemoExample, shown: 0 | 1) => readonly Element[]} */
const switcher = (e, shown) => e.schemas.length === 1 ? [] : [['p', schemaButton(0, shown), ' ', schemaButton(1, shown)]]

/** @type {(s: DemoSchema, text: string) => readonly Element[]} */
const schemaView = (s, text) => {
    const r = _readersOf(s.schema)(text)
    return [
        ['pre', s.source],
        ['p', 'TypeScript:'],
        ['pre', _tsOf(s.schema)],
        ['p',
            ['label', { for: 'value' }, 'Value (JSON) '],
            ['textarea', { id: 'value', name: 'value', rows: '4' }, text],
        ],
        .../** @type {readonly Element[]} */ ('json' in r
            ? [['p', `Not JSON: ${r.json}`]]
            : [['p', 'parse:'], ['pre', r.parse], ['p', 'validate:'], ['pre', r.validate]]),
        graphSvg(_graphOf(s.schema)),
    ]
}

/**
 * The state is the picked example's name, the schema shown, and the text;
 * everything drawn is a function of the three. Picking an example shows its
 * first schema and its value; flipping between a pair's schemas keeps the
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
        return ['div',
            ['p',
                ['label', { for: 'example' }, 'Example '],
                ['select', { id: 'example', name: 'example' }, ...examples.map(x => exampleOption(x, e))],
            ],
            ['p', e.about],
            ...switcher(e, shown),
            ...schemaView(shown === 1 && b !== undefined ? b : a, text),
            .../** @type {readonly Element[]} */ (b === undefined ? [] : [['p', _compare(a.schema)(b.schema)]]),
        ]
    },
}
