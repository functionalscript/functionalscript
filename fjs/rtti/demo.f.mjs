/**
 * A schema, drawn as a graph under its code, what rtti derives from it, and a
 * value as you type it, with what `parse` and `validate` make of the value
 * under it.
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
 * **Lessons, then the project's own schemas.** The drop-down has two groups.
 * The seven lessons are schemas written for the demo, each showing one rule.
 * The fourteen others are schemas the project itself uses, imported from the
 * modules that declare them, each with a value it accepts.
 *
 * **One schema, or two where the difference is the lesson.** Of the seven
 * lessons, three show a single schema and four are pairs. A pair shows both
 * schemas, each a block with a radio dot, and the reader picks one while the
 * value stays put, so the one thing that changes is the schema. The schemas'
 * own code tells them apart, so they carry no names.
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
 * **One schema, many outputs.** Under the graph come the TypeScript type
 * `fjs/rtti/ts` prints, the JSON Schema `fjs/media/json/schema` converts it
 * to, and the canonical data form both are printed from — the outputs a
 * consumer gets from the one declaration besides the two readers.
 *
 * **A schema compares with any other.** The shown schema is compared with one
 * the reader picks, through the data form's `equal` and `subset`, so "two
 * spellings, one set" is a verdict the page computes rather than a claim. A
 * pair compares its two schemas until the reader picks another.
 *
 * **A failure points into the value.** When `validate` refuses the value, the
 * value is written again with the member its error path reaches marked.
 *
 * **It needs no operations.** Every part is a pure function of the state, so
 * `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../website/demo/types.ts'
 * @import { Graph, Shape } from '../website/demo/graph/types.ts'
 * @import { Element, Node } from '../media/html/types.ts'
 * @import { Unknown } from '../media/datajs/types.ts'
 * @import { List } from '../types/list/types.ts'
 * @import { Const, DemoExample, DemoSchema, DemoState, Type, _Answer } from './types.ts'
 */

import { array, boolean, number, open, option, or, record, rest, string, unknown } from './module.f.mjs'
import { structSchemaEntries, tupleSchemaEntries } from './common/module.f.mjs'
import { parse } from './parse/module.f.mjs'
import { validate } from './validate/module.f.mjs'
import { equal, subset, toData } from './data/module.f.mjs'
import { dataToTs } from './ts/module.f.mjs'
import { dataToJsonSchema } from '../media/json/schema/module.f.mjs'
import { stringify } from '../media/json/module.f.mjs'
import { identity } from '../types/function/module.f.mjs'
import { tryParse, trySerialize } from '../media/datajs/module.f.mjs'
import { leafSerialize } from '../media/datajs/serializer/module.f.mjs'
import { unwrap } from '../types/result/module.f.mjs'
import { concat } from '../types/string/module.f.mjs'
import { dropWhile, first, flat, intersperse, map, stateScan, takeWhile, toArray } from '../types/list/module.f.mjs'
import { graphOf, graphSvg } from '../website/demo/graph/module.f.mjs'
import { pureOk } from '../effects/module.f.mjs'
import { pageHref } from '../website/page/module.f.mjs'
import { request } from '../protocol/json_rpc/module.f.mjs'
import { tool } from '../protocol/mcp/module.f.mjs'
import { casAddArgs } from '../mcp/cas/module.f.mjs'
import { evoAddArgs } from '../mcp/evo/module.f.mjs'
import { revisionSchema } from '../media/revision/module.f.mjs'
import { lockSchema } from '../media/lock/module.f.mjs'
import { noteSchema } from '../media/note/module.f.mjs'
import { unknown as jsonValue } from '../media/json/rtti/module.f.mjs'
import { unknown as jsonSchema } from '../media/json/schema/module.f.mjs'
import { gitHubActionSchema } from '../ci/common/module.f.mjs'
import { op1Id } from '../edag/module.f.mjs'
import { value as edagValue } from '../edag/value/module.f.mjs'
import { dirent } from '../effects/schema/module.f.mjs'
import { fundingSchema } from '../website/funding/module.f.mjs'

const person = /** @type {const} */ ({ name: string, age: number })

const address = /** @type {const} */ ({ street: string, city: string })

const order = /** @type {const} */ ({
    id: number,
    billing: address,
    shipping: address,
    items: array({ sku: string, qty: number }),
    note: or(option, string),
})

/** @type {Type} */
const tree = () => ['const', { value: number, children: array(tree) }]

/**
 * The lessons: schemas written for the demo, each showing one rule. The pairs
 * come first, because the first thing a reader sees should be a value that
 * one schema accepts and the other refuses.
 *
 * @type {readonly DemoExample[]}
 */
export const lessons = [
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

/**
 * A schema the project itself declares, shown as the import of its export
 * from the module that holds it, so what the reader picks is the schema the
 * code runs, not a copy that could drift from it.
 *
 * @type {(name: string, module: string, schema: Type) => readonly [DemoSchema]}
 */
const inProject = (name, module, schema) => [{ source: name, schema, module: `fjs/${module}` }]

/**
 * Schemas the project uses, one for each module that declares a schema and
 * reads values with it — protocols, media formats, JSON itself, CI, the
 * expression graph, data-shaped effects and the site. Each value
 * is one the schema accepts, so a reader starts from a working document and
 * breaks it.
 *
 * Three modules use rtti without a schema of their own, so they have no
 * entry: `fjs/media` matches a blob against the format schemas below,
 * `fjs/edag/value/metadata` checks an evaluated value's metadata with rtti's
 * error helpers after `fjs/edag/value`'s shape check, and `fjs/nanvm` checks
 * its operator cases against `fjs/edag`'s `op1Id` and `op3Id` with
 * `validate`.
 *
 * @type {readonly DemoExample[]}
 */
export const projectSchemas = [
    {
        name: 'JSON-RPC request',
        about: 'A JSON-RPC 2.0 request; without an id it is a notification. open(), so a peer on a later protocol revision can add members. Read with parse.',
        schemas: inProject('request', 'protocol/json_rpc', request),
        value: 'export default {"jsonrpc":"2.0","method":"tools/list","id":1};',
    },
    {
        name: 'MCP tool',
        about: 'A tool an MCP server advertises in tools/list: a name, a description, and the JSON Schema of its arguments. Read with parse.',
        schemas: inProject('tool', 'protocol/mcp', tool),
        value: 'export default {"name":"cas_get","description":"Read a blob by its hash","inputSchema":{"type":"object","properties":{"hash":{"type":"string"}},"required":["hash"]}};',
    },
    {
        name: 'cas_add arguments',
        about: 'The arguments of the cas_add MCP tool. One schema is both the inputSchema the server advertises and the check its arguments pass. Closed: the server defines the vocabulary.',
        schemas: inProject('casAddArgs', 'mcp/cas', casAddArgs),
        value: 'export default {"content":"hello","type":"text"};',
    },
    {
        name: 'evo_add arguments',
        about: 'The arguments of the evo_add MCP tool: a new revision. Its lock is the revision format\'s own lockField schema, a recursive map, reused rather than restated.',
        schemas: inProject('evoAddArgs', 'mcp/evo', evoAddArgs),
        value: 'export default {"parents":["b7m2mnk9w0vqwhh4"],"subject":"todo","snapshot":"c1dq3pe0t4f7a2kx"};',
    },
    {
        name: 'Revision',
        about: 'vnd.fjs.revision: one step in the history of a mutable object over a content-addressable store. open(), so an older reader still reads a revision a newer writer extended.',
        schemas: inProject('revisionSchema', 'media/revision', revisionSchema),
        value: 'export default {"dialect":"vnd.fjs.revision","subject":"todo","parents":[],"snapshot":"c1dq3pe0t4f7a2kx","generation":0};',
    },
    {
        name: 'Lock',
        about: 'vnd.fjs.lock: a lock map as a blob of its own, so several revisions can share one resolution. The map nests: a value is a hash or another map.',
        schemas: inProject('lockSchema', 'media/lock', lockSchema),
        value: 'export default {"dialect":"vnd.fjs.lock","lock":{"fjs":"c1dq3pe0t4f7a2kx","deps":{"left-pad":"b7m2mnk9w0vqwhh4"}}};',
    },
    {
        name: 'Note',
        about: 'vnd.fjs.note: a note, todo or issue as a blob: its text, what it depends on, and a priority from P1 to P5.',
        schemas: inProject('noteSchema', 'media/note', noteSchema),
        value: 'export default {"dialect":"vnd.fjs.note","text":"Show the project\'s own schemas in the rtti demo","priority":"P2"};',
    },
    {
        name: 'Any JSON value',
        about: 'The JSON data model as a schema: a primitive, an object of JSON values, or an array of them. Recursive, so the graph draws the use of unknown by its name.',
        schemas: inProject('unknown', 'media/json/rtti', jsonValue),
        value: 'export default {"name":"fjs","tags":["data","schema"],"stars":42,"private":false,"homepage":null};',
    },
    {
        name: 'JSON Schema',
        about: 'A JSON Schema (draft 2020-12) object, the target toJsonSchema converts rtti schemas into. Recursive: a schema\'s properties and items are schemas.',
        schemas: inProject('unknown', 'media/json/schema', jsonSchema),
        value: 'export default {"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]};',
    },
    {
        name: 'GitHub Actions workflow',
        about: 'A workflow as this repository generates it. Closed: CI reads its own generated workflows back, so a key the schema does not name is generator drift.',
        schemas: inProject('gitHubActionSchema', 'ci/common', gitHubActionSchema),
        value: 'export default {"name":"CI","on":{"pull_request":{}},"permissions":{"contents":"read"},"jobs":{"test":{"runs-on":"ubuntu-latest","steps":[{"uses":"actions/checkout@v5"},{"run":"npm test"}]}}};',
    },
    {
        name: 'Unary operator',
        about: 'The unary operators of the expression graph, as a union of strings. The VM\'s operator cases check membership with validate, the one project use that keeps the value.',
        schemas: inProject('op1Id', 'edag', op1Id),
        value: 'export default "typeof";',
    },
    {
        name: 'Evaluated EDAG value',
        about: 'An evaluated value of the expression graph: data, and functions whose captures are values. Recursive. Read with validate, so a checked value keeps its identity and sharing.',
        schemas: inProject('value', 'edag/value', edagValue),
        value: 'export default ["[]",[1,"a",["undefined"]]];',
    },
    {
        name: 'Directory entry',
        about: 'An entry readdir answers, described by a data-validation schema in effects/schema. The corresponding handwritten TypeScript operation declarations are checked against schema-derived types.',
        schemas: inProject('dirent', 'effects/schema', dirent),
        value: 'export default {"name":"module.f.mjs","parentPath":"fjs/rtti","isFile":true,"isDirectory":false};',
    },
    {
        name: 'Funding channels',
        about: 'funding.json as the site footer reads it: only the funding channels. open() at every level, because the format carries much more and none of it is the footer\'s business.',
        schemas: inProject('fundingSchema', 'website/funding', fundingSchema),
        value: 'export default {"version":"v1.0.0","funding":{"channels":[{"guid":"github","type":"other","address":"https://github.com/sponsors/sergey-shandar","description":"GitHub Sponsors"}]}};',
    },
]

/** Every example, lessons first, in the order the drop-down lists them. */
export const examples = [...lessons, ...projectSchemas]

/** @type {(name: string) => DemoExample} */
const exampleOf = name => {
    const found = examples.find(e => e.name === name)
    if (found === undefined) { throw 'rtti demo: no example has this name' }
    return found
}

/**
 * The key a schema is picked by in the comparison's drop-down: its example's
 * name and its place in the example.
 *
 * @type {(e: DemoExample, i: number) => string}
 */
const schemaKey = (e, i) => `${e.name}#${i}`

/**
 * Every schema of every example, under its key, in the drop-down's order.
 *
 * @type {readonly (readonly [string, DemoExample, DemoSchema])[]}
 */
const keyedSchemas = examples.flatMap(e => e.schemas.map(
    /** @type {(s: DemoSchema, i: number) => readonly [string, DemoExample, DemoSchema]} */
    (s, i) => [schemaKey(e, i), e, s]))

/** @type {(key: string) => DemoSchema} */
const schemaOf = key => {
    const found = keyedSchemas.find(([k]) => k === key)
    if (found === undefined) { throw 'rtti demo: no schema has this key' }
    return found[2]
}

/**
 * What the shown schema is compared with when the reader picks example `e`
 * and shows its schema `shown`: a pair's other schema, or nothing.
 *
 * @type {(e: DemoExample, shown: 0 | 1) => string}
 */
const partnerOf = (e, shown) => e.schemas.length === 2 ? schemaKey(e, shown === 0 ? 1 : 0) : ''

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
 * or where and why it failed — the failure's path kept as well as written,
 * so the value can be marked where it points.
 *
 * @type {(r: readonly ['ok', unknown] | readonly ['error', { readonly path: readonly (string | number)[], readonly message: string }]) => _Answer}
 */
const answerOf = r => r[0] === 'ok'
    ? { ok: true, text: documentText(/** @type {Unknown} */ (r[1])) }
    : { ok: false, text: `at ${pathText(r[1].path)}: ${r[1].message}`, path: r[1].path }

/**
 * What `parse` and `validate` make of `text` against `schema`, and the value
 * the text denotes, or the parser's error when `text` is not a DataJS
 * document.
 *
 * @type {(schema: Type) => (text: string) => { readonly parse: _Answer, readonly validate: _Answer, readonly value: Unknown } | { readonly error: string }}
 */
export const _readersOf = schema => text => {
    const document = tryParse(text)
    if (document[0] === 'error') { return { error: document[1] } }
    const value = document[1]
    const s = /** @type {any} */ (schema)
    return { parse: answerOf(parse(s)(value)), validate: answerOf(validate(s)(value)), value }
}

// ── where a failure points ───────────────────────────────────────────────────

/**
 * A value as one DataJS expression, lazily, a chunk at a time. Sharing is
 * written out, so a value that shares much is far longer as one expression
 * than as the document that denotes it; nothing here reads further than its
 * caller takes.
 *
 * @type {(value: Unknown) => List<string>}
 */
const expressionChunks = value => {
    if (value === null || typeof value !== 'object') { return [concat(leafSerialize(value))] }
    /** @type {(items: List<List<string>>) => List<string>} */
    const items = list => flat(intersperse([','])(list))
    return value instanceof Array
        ? flat([['['], items(map(expressionChunks)([...value])), [']']])
        : flat([['{'], items(map(
            /** @type {(e: readonly [string, Unknown]) => List<string>} */
            ([k, v]) => flat([[`${concat(leafSerialize(k))}:`], () => expressionChunks(v)]))(Object.entries(value))), ['}']])
}

/**
 * `value` as one expression, cut to at most `limit` characters, with `…`
 * where it was cut. Reading stops at the cut, so the cost is bounded by
 * `limit` however much the value shares.
 *
 * @type {(limit: number) => (value: Unknown) => string}
 */
const boundedText = limit => value => {
    const counted = stateScan(
        /** @type {(c: string, n: number) => readonly [readonly [number, string], number]} */
        (c, n) => [[n + c.length, c], n + c.length])(0)(expressionChunks(value))
    /** @type {(e: readonly [number, string]) => boolean} */
    const fits = ([n]) => n <= limit
    const kept = toArray(takeWhile(fits)(counted)).map(([, c]) => c).join('')
    return first(null)(dropWhile(fits)(counted)) === null ? kept : `${kept}…`
}

/** How much of the marked value is written. */
const markLimit = 400

/** How much of each member beside the path is written. */
const besideLimit = 40

/**
 * `value` written as one expression with the member `path` reaches marked.
 * A path ends at the member that failed — or, for a member that is missing,
 * at the key the schema required — so the deepest value the path reaches is
 * what gets the mark: the member itself, or the container it is missing from.
 *
 * Only the path is written in full. The marked value and each member beside
 * the path are cut to a few characters' worth, so a value that shares much —
 * a valid DataJS document can denote a graph whose expansion is exponential
 * in its length — is never expanded past what is shown.
 *
 * @type {(path: readonly (string | number)[]) => (value: Unknown) => readonly Node[]}
 */
export const _marked = path => value => {
    if (path.length === 0 || value === null || typeof value !== 'object') { return [['mark', boundedText(markLimit)(value)]] }
    const [step, ...rest] = path
    const key = String(step)
    if (Object.getOwnPropertyDescriptor(value, key) === undefined) { return [['mark', boundedText(markLimit)(value)]] }
    /** @type {(k: string, v: Unknown) => readonly Node[]} */
    const member = (k, v) => k === key ? _marked(rest)(v) : [boundedText(besideLimit)(v)]
    /** @type {(nodes: readonly (readonly Node[])[]) => readonly Node[]} */
    const commas = nodes => nodes.flatMap((n, i) => i === 0 ? n : [',', ...n])
    return value instanceof Array
        ? ['[', ...commas([...value].map((v, i) => member(String(i), v))), ']']
        : ['{', ...commas(Object.entries(value).map(([k, v]) => [`${concat(leafSerialize(k))}:`, ...member(k, v)])), '}']
}

// ── outputs and comparison ───────────────────────────────────────────────────

/**
 * What rtti derives from `schema` besides its readers, each as text: the
 * TypeScript type the printer writes — its recursive definitions first, as
 * `type` aliases, then the type itself — the JSON Schema, and the canonical
 * data form both are printed from.
 *
 * @type {(schema: Type) => { readonly ts: string, readonly jsonSchema: string, readonly data: string }}
 */
export const _outputsOf = schema => {
    const data = toData(schema)
    const [definitions, entry] = dataToTs()(data)
    return {
        ts: [...definitions.map(([name, type]) => `type ${name} = ${type}`), entry].join('\n'),
        jsonSchema: stringify(identity)(dataToJsonSchema(data)),
        data: documentText(/** @type {Unknown} */ (data)),
    }
}

/**
 * What the data form says of two schemas: whether their canonical forms are
 * one, and whether each is a `subset` of the other — as the calls, and as one
 * sentence. `subset` is sound but incomplete, so a `false` is "not shown",
 * never "shown not".
 *
 * @type {(a: Type, b: Type) => { readonly calls: string, readonly verdict: string }}
 */
export const _compare = (a, b) => {
    const [da, db] = [toData(a), toData(b)]
    const same = equal(da)(db)
    const ab = subset(da)(db)
    const ba = subset(db)(da)
    return {
        calls: `equal → ${same}\nsubset(this)(that) → ${ab}\nsubset(that)(this) → ${ba}`,
        verdict: same ? 'One set: the two schemas have one canonical form.'
            : ab && ba ? 'One set, spelled two ways: each schema includes the other.'
            : ab ? 'Included: every value this schema accepts, that one accepts too.'
            : ba ? 'Includes: this schema accepts every value that one accepts.'
            : 'Neither is shown to include the other.',
    }
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
 * The drop-down's options in two groups: the lessons, then the schemas the
 * project uses.
 *
 * @type {(picked: DemoExample) => readonly Element[]}
 */
const exampleGroups = picked => [
    ['optgroup', { label: 'Lessons' }, ...lessons.map(x => exampleOption(x, picked))],
    ['optgroup', { label: 'Used in this project' }, ...projectSchemas.map(x => exampleOption(x, picked))],
]

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
 * The npm package the repository publishes, `package.json`'s `name`. A project
 * schema's import names its module through it, so the line is the one a
 * package user writes: the package has no `exports` map, so every shipped
 * module is importable by its path under the package name.
 */
const packageName = 'functionalscript'

/**
 * A single schema as a code block. One the project uses is the import that
 * brings it in —
 * `import { noteSchema } from 'functionalscript/fjs/media/note/module.f.mjs'` —
 * one line of code saying both which export and which module, and one that
 * resolves when copied into a project that depends on the package. The module
 * specifier is a link to the module's page on the site; the href is the
 * site's own `pageHref`, so it works on a preview as on the published site.
 *
 * @type {(s: DemoSchema) => Element}
 */
const codeView = s => s.module === undefined
    ? ['pre', { 'data-code': '' }, s.source]
    : ['pre', { 'data-code': '' },
        `import { ${s.source} } from `,
        ['a', { href: pageHref(s.module) }, `'${packageName}/${s.module}/module.f.mjs'`],
    ]

/**
 * The example's schemas: a single one as a code block, a pair as two choices,
 * both in sight.
 *
 * @type {(e: DemoExample, shown: 0 | 1) => Element}
 */
const schemasView = (e, shown) => e.schemas.length === 1
    ? codeView(e.schemas[0])
    : ['div', { 'data-pick': '' }, schemaChoice(e.schemas[0], 0, shown), schemaChoice(e.schemas[1], 1, shown)]

/**
 * What rtti derives from the schema, each under its name, so one declaration
 * reads as the several things a consumer gets from it. The canonical form is
 * the machinery under the other two, so it is folded away.
 *
 * @type {(s: DemoSchema) => readonly Element[]}
 */
const outputsView = s => {
    const o = _outputsOf(s.schema)
    return [
        ['p', 'TypeScript:'],
        ['pre', { 'data-code': '' }, o.ts],
        ['p', 'JSON Schema:'],
        ['pre', { 'data-code': '' }, o.jsonSchema],
        ['details', ['summary', 'Canonical form (toData)'], ['pre', { 'data-code': '' }, o.data]],
    ]
}

/** @type {(key: string, compare: string, label: string) => Element} */
const compareOption = (key, compare, label) =>
    ['option', key === compare ? { value: key, selected: '' } : { value: key }, label]

/**
 * The comparison: a drop-down of every schema in the demo, and, when one is
 * picked, what the data form says of the shown schema and it.
 *
 * @type {(s: DemoSchema, compare: string) => readonly Element[]}
 */
const compareView = (s, compare) => {
    /** @type {(group: readonly DemoExample[]) => readonly Element[]} */
    const options = group => keyedSchemas
        .filter(([, e]) => group.includes(e))
        .map(([k, e, x]) => compareOption(k, compare, e.schemas.length === 1 ? e.name : `${e.name}: ${x.source}`))
    const c = compare === '' ? undefined : _compare(s.schema, schemaOf(compare).schema)
    return [
        ['p',
            ['label', { for: 'compare' }, 'Compare with '],
            ['select', { id: 'compare', name: 'compare' },
                compareOption('', compare, 'nothing'),
                ['optgroup', { label: 'Lessons' }, ...options(lessons)],
                ['optgroup', { label: 'Used in this project' }, ...options(projectSchemas)],
            ],
        ],
        ...(c === undefined ? [] : /** @type {readonly Element[]} */ ([
            ['p', c.verdict],
            ['pre', { 'data-code': '' }, c.calls],
        ])),
    ]
}

/**
 * The value box and, under it, what the two readers make of the value
 * against `s` — kept together, since the answers are what typing changes —
 * and, when `validate` refuses it, the value with the failing member marked.
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
                ...(r.validate.path === undefined ? [] : /** @type {readonly Element[]} */ ([
                    ['p', 'Where:'],
                    ['pre', { 'data-code': '' }, ..._marked(r.validate.path)(r.value)],
                ])),
            ]),
    ]
}

/**
 * The state on picking `e`: its first schema, compared with its pair's other
 * one, and its value.
 *
 * @type {(e: DemoExample) => DemoState}
 */
const picking = e => ({ example: e.name, shown: 0, compare: partnerOf(e, 0), text: e.value })

/**
 * The state on picking schema `shown` of a pair: compared with the other one,
 * the value kept as typed.
 *
 * @type {(state: DemoState, shown: 0 | 1) => DemoState}
 */
const showing = (state, shown) => ({ ...state, shown, compare: partnerOf(exampleOf(state.example), shown) })

/**
 * The state is the picked example's name, the schema shown, the schema it is
 * compared with, and the text; everything drawn is a function of the four.
 * Picking an example shows its first schema and its value, compared with its
 * pair's other schema if it has one; picking a schema of a pair compares it
 * with the other and keeps the value as typed.
 *
 * @type {Demo<DemoState, DemoEvent>}
 */
export const demo = {
    init: picking(examples[0]),
    update: state => event => pureOk(
        event.kind === 'input'
            ? event.name === 'example'
                ? picking(exampleOf(event.value))
                : event.name === 'compare'
                    ? { ...state, compare: event.value }
                    : { ...state, text: event.value }
            : event.kind === 'click' && (event.name === 'schema-0' || event.name === 'schema-1')
                ? showing(state, event.name === 'schema-0' ? 0 : 1)
                : state),
    view: ({ example, shown, compare, text }) => {
        const e = exampleOf(example)
        const [a, b] = e.schemas
        // The schema shown, then its graph — a picture of the schema, so it
        // sits by it and changes with the pick — what rtti derives from it,
        // the comparison, and the value with its answers last.
        const s = shown === 1 && b !== undefined ? b : a
        return ['div',
            ['p',
                ['label', { for: 'example' }, 'Example '],
                ['select', { id: 'example', name: 'example' }, ...exampleGroups(e)],
            ],
            ['p', e.about],
            schemasView(e, shown),
            graphSvg(_graphOf(s.schema)),
            ...outputsView(s),
            ...compareView(s, compare),
            ...valueView(s, text),
        ]
    },
}
