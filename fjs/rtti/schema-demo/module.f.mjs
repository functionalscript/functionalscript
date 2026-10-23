/**
 * The rtti demo as a factory: given the examples to offer, in labelled
 * groups, the demo that draws the picked schema as a graph, what rtti derives
 * from it, a comparison with any other schema offered, and a value as the
 * reader types it with what `parse` and `validate` make of it.
 *
 * **One demo, many pages.** The module page's demo
 * ([`../demo.f.mjs`](../demo.f.mjs)) offers every lesson and the project's own
 * schemas; a guide page's demo
 * ([`../guide/README.md`](../guide/README.md)) offers that page's lessons
 * alone. Both are this function of their groups, so a page shows its schema
 * the way the module page does, and a change to one is a change to all.
 *
 * **A control with one choice is not drawn.** The example drop-down appears
 * only when there is more than one example, and the comparison only when
 * there is another schema to compare with, so a page with a single schema
 * shows the schema, its outputs and its value, and nothing to pick.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Graph, Shape } from '../../website/demo/graph/types.ts'
 * @import { Element, Node } from '../../media/html/types.ts'
 * @import { Unknown } from '../../media/datajs/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Const, DemoExample, DemoGroup, DemoSchema, DemoState, Type, _Answer } from '../types.ts'
 * @import { Marked, Run } from '../../text/marked/types.ts'
 */

import { captionMarker, codeMarker, resultMarker, verdictMarker } from '../../website/style/module.f.js'
import { unknown } from '../module.f.mjs'
import { structSchemaEntries, tupleSchemaEntries } from '../common/module.f.mjs'
import { parse } from '../parse/module.f.mjs'
import { validate } from '../validate/module.f.mjs'
import { equal, subset, toData } from '../data/module.f.mjs'
import { dataToTsMarked } from '../ts/module.f.mjs'
import { dataToJsonSchema } from '../../media/json/schema/module.f.mjs'
import { marked } from '../../media/json/module.f.mjs'
import { identity } from '../../types/function/module.f.js'
import { tryMarked, tryParse } from '../../media/datajs/module.f.mjs'
import { leafSerialize } from '../../media/datajs/serializer/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'
import { concat } from '../../types/string/module.f.mjs'
import { dropWhile, first, flat, intersperse, map, stateScan, takeWhile, toArray } from '../../types/list/module.f.mjs'
import { graphOf, graphSvg } from '../../website/demo/graph/module.f.mjs'
import { caption, textField } from '../../website/demo/module.f.mjs'
import { highlight, render } from '../../website/demo/highlight/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { pageHref } from '../../website/page/module.f.mjs'
import { chunksMarked, chunksText, keyword } from '../../text/marked/module.f.mjs'

// ── graph ────────────────────────────────────────────────────────────────────

/**
 * A constant schema: a struct or a tuple is a node with a port per declared
 * member; a primitive draws inline, spelled as DataJS spells it.
 *
 * @type {(c: Const) => Shape<Type>}
 */
const constShape = c => c === null || typeof c !== 'object'
    ? { inline: chunksText(leafSerialize(c)) }
    : c instanceof Array
        ? { kind: 'tuple', label: '[]', children: tupleSchemaEntries(c) }
        : { kind: 'struct', label: '{}', children: structSchemaEntries(c) }

/**
 * What a thunk returns, as a shape, its label led by `name` when the thunk
 * has one. A built-in draws inline; `open(c)` is `rest(c, unknown)` and
 * draws as `open`. The ports of an `array`, a `record`, an `or` and an
 * `open` have empty keys: the node's label already says what each of them
 * is, so an inline member fills its row and an edge's row stays empty. A
 * `rest` keeps `declared` and `extra`, which tell its two ports apart.
 *
 * @type {(name: string) => (info: ReturnType<Exclude<Type, Const>>) => Shape<Type>}
 */
const infoShape = name => info => {
    /** @type {(label: string) => string} */
    const named = label => name === '' ? label : `${name} ${label}`
    switch (info[0]) {
        case 'const': {
            const s = constShape(info[1])
            return 'label' in s ? { ...s, label: named(s.label) } : s
        }
        case 'array': { return { kind: 'array', label: named('array'), children: [['', info[1]]] } }
        case 'record': { return { kind: 'record', label: named('record'), children: [['', info[1]]] } }
        case 'or': {
            const [, ...members] = info
            return members.length === 0
                ? { inline: 'never' }
                : { kind: 'or', label: named('or'), children: members.map(/** @type {(m: Type) => readonly [string, Type]} */ m => ['', m]) }
        }
        case 'rest': {
            const [, c, r] = info
            return r === unknown
                ? { kind: 'rest', label: named('open'), children: [['', c]] }
                : { kind: 'rest', label: named('rest'), children: [['declared', c], ['extra', r]] }
        }
        default: { return { inline: info[0] } }
    }
}

/**
 * A thunk is what it returns, with its name on the node. Its identity shares
 * that definition across uses; a recursive use is a back edge to it.
 * Built-ins and primitive constants stay inline.
 *
 * @type {(t: Type) => Shape<Type>}
 */
const shapeOf = t => {
    const shape = typeof t !== 'function' ? constShape(t) : infoShape(t.name)(t())
    return 'children' in shape ? { ...shape, recursive: true } : shape
}

/**
 * `schema` as a graph, including the definitions of every reachable named
 * schema. Each definition is drawn once; shared uses point to that node,
 * and recursive uses go back to it around the graph. Each return has its
 * own lane and entry point; hover or focus traces one complete connection.
 *
 * @type {(schema: Type) => Graph}
 */
export const _graphOf = schema => ({ ...graphOf(shapeOf)(schema), trace: true, centerColumns: true })

// ── readers ──────────────────────────────────────────────────────────────────

/** @type {(path: readonly (string | number)[]) => string} */
const pathText = path => path.length === 0 ? 'the root' : path.join('.')

/**
 * A value as the marked DataJS document that denotes it, one statement per
 * line, so a `const` a value shares stands on a line of its own above the
 * `export default` that uses it. The serializer emits each statement's
 * closing `;` as a plain run of its own — a `;` inside a string is part of
 * that string's run — so the lines break there, after every statement but
 * the last.
 *
 * @type {(value: Unknown) => Marked}
 */
const documentMarked = value => {
    const runs = unwrap(tryMarked(value))
    return runs.map((run, i) => run[0] === ';' && run[1] === undefined && i < runs.length - 1
        ? /** @type {Run} */ ([';\n'])
        : run)
}

/**
 * One reader's answer: whether it succeeded, and the value it succeeded with
 * or where and why it failed — the failure's path kept as well as written,
 * so the value can be marked where it points.
 *
 * @type {(r: readonly ['ok', unknown] | readonly ['error', { readonly path: readonly (string | number)[], readonly message: string }]) => _Answer}
 */
const answerOf = r => r[0] === 'ok'
    ? { ok: true, marked: documentMarked(/** @type {Unknown} */ (r[1])) }
    : { ok: false, text: `at ${pathText(r[1].path)}: ${r[1].message}`, path: r[1].path }

/**
 * A schema the project itself declares, shown as the import of its export
 * from the module that holds it, so what the reader picks is the schema the
 * code runs, not a copy that could drift from it. `module` is the module's
 * directory under `fjs/`.
 *
 * @type {(name: string, module: string, schema: Type) => readonly [DemoSchema]}
 */
export const projectSchema = (name, module, schema) => [{ source: name, schema, module: `fjs/${module}` }]

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
    if (value === null || typeof value !== 'object') { return [chunksText(leafSerialize(value))] }
    /** @type {(items: List<List<string>>) => List<string>} */
    const items = list => flat(intersperse([','])(list))
    return value instanceof Array
        ? flat([['['], items(map(expressionChunks)([...value])), [']']])
        : flat([['{'], items(map(
            /** @type {(e: readonly [string, Unknown]) => List<string>} */
            ([k, v]) => flat([[`${chunksText(leafSerialize(k))}:`], () => expressionChunks(v)]))(Object.entries(value))), ['}']])
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
        : ['{', ...commas(Object.entries(value).map(([k, v]) => [`${chunksText(leafSerialize(k))}:`, ...member(k, v)])), '}']
}

// ── outputs and comparison ───────────────────────────────────────────────────

/**
 * What rtti derives from `schema` besides its readers: the TypeScript type
 * the printer writes — its recursive definitions first, as `type` aliases,
 * then the type itself — the JSON Schema, and the canonical data form both
 * are printed from. Each is marked by the writer that prints it.
 *
 * @type {(schema: Type) => { readonly ts: Marked, readonly jsonSchema: Marked, readonly data: Marked }}
 */
export const _outputsOf = schema => {
    const data = toData(schema)
    const [definitions, entry] = dataToTsMarked()(data)
    return {
        ts: chunksMarked([...definitions.flatMap(([name, type]) => [keyword('type'), ' ', ...name, ' = ', ...type, '\n']), ...entry]),
        jsonSchema: marked(identity)(dataToJsonSchema(data)),
        data: documentMarked(/** @type {Unknown} */ (data)),
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
 * failure. The verdict is a word as well as a colour: the word is coloured
 * green or red, and so are the block's tint and edge, while the block's text
 * keeps the text colour, so a value it holds reads in the token colours of
 * every other code block. The block holds nothing but what a reader could
 * paste back into the value box.
 *
 * @type {(label: string, ok: boolean, nodes: readonly Node[]) => readonly Element[]}
 */
const answerView = (label, ok, nodes) => {
    const verdict = ok ? 'ok' : 'error'
    return [
        ['p', { [captionMarker]: '' }, `${label} · `, ['span', { [verdictMarker]: verdict }, verdict]],
        ['pre', { [codeMarker]: '', [resultMarker]: verdict }, ...nodes],
    ]
}

/** A reader's answer as the nodes its block holds: the value coloured, or the failure. @type {(a: _Answer) => readonly Node[]} */
const answerNodes = a => a.ok ? render(a.marked) : [a.text]

/**
 * One schema of a pair: its code with a radio dot, as a button the reader
 * picks it with, pressed when it is the one shown.
 *
 * @type {(s: DemoSchema, i: 0 | 1, shown: 0 | 1) => Element}
 */
const schemaChoice = (s, i, shown) =>
    ['button', { type: 'button', name: `schema-${i}`, 'aria-pressed': String(i === shown) },
        ['span', { 'data-pick-dot': '' }],
        ['span', { 'data-pick-code': '' }, ...highlight(s.source)],
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
    ? ['pre', { [codeMarker]: '' }, ...highlight(s.source)]
    : ['pre', { [codeMarker]: '' },
        ...highlight(`import { ${s.source} } from `),
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
        caption('TypeScript:'),
        ['pre', { [codeMarker]: '' }, ...render(o.ts)],
        caption('JSON Schema:'),
        ['pre', { [codeMarker]: '' }, ...render(o.jsonSchema)],
        ['details', ['summary', 'Canonical form (toData)'], ['pre', { [codeMarker]: '' }, ...render(o.data)]],
    ]
}

/** @type {(key: string, compare: string, label: string) => Element} */
const compareOption = (key, compare, label) =>
    ['option', key === compare ? { value: key, selected: '' } : { value: key }, label]

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
        textField({ name: 'value', label: 'Value (DataJS)', rows: 4, highlight }, text),
        .../** @type {readonly Element[]} */ ('error' in r
            ? answerView('DataJS', false, [r.error])
            : [
                ...answerView('parse', r.parse.ok, answerNodes(r.parse)),
                ...answerView('validate', r.validate.ok, answerNodes(r.validate)),
                ...(r.validate.ok ? [] : /** @type {readonly Element[]} */ ([
                    caption('Where:'),
                    ['pre', { [codeMarker]: '' }, ..._marked(r.validate.path)(r.value)],
                ])),
            ]),
    ]
}


// ── the demo ─────────────────────────────────────────────────────────────────

/**
 * The key a schema is picked by in the comparison's drop-down: its example's
 * name and its place in the example.
 *
 * @type {(e: DemoExample, i: number) => string}
 */
const schemaKey = (e, i) => `${e.name}#${i}`

/**
 * What the shown schema is compared with when the reader picks example `e`
 * and shows its schema `shown`: a pair's other schema, or nothing.
 *
 * @type {(e: DemoExample, shown: 0 | 1) => string}
 */
const partnerOf = (e, shown) => e.schemas.length === 2 ? schemaKey(e, shown === 0 ? 1 : 0) : ''

/** @type {(e: DemoExample, picked: DemoExample) => Element} */
const exampleOption = (e, picked) =>
    ['option', e === picked ? { value: e.name, selected: '' } : { value: e.name }, e.name]

/**
 * The state on picking `e`: its first schema, compared with its pair's other
 * one, and its value.
 *
 * @type {(e: DemoExample) => DemoState}
 */
const picking = e => ({ example: e.name, shown: 0, compare: partnerOf(e, 0), text: e.value })

/**
 * The demo offering `groups`, each a label and its examples, in the order the
 * drop-downs list them; it opens on the first example.
 *
 * The state is the picked example's name, the schema shown, the schema it is
 * compared with, and the text; everything drawn is a function of the four.
 * Picking an example shows its first schema and its value, compared with its
 * pair's other schema if it has one; picking a schema of a pair compares it
 * with the other and keeps the value as typed.
 *
 * @type {(groups: readonly DemoGroup[]) => Demo<DemoState, DemoEvent>}
 */
export const schemaDemo = groups => {
    const examples = groups.flatMap(([, g]) => g)
    const [start] = examples
    if (start === undefined) { throw 'rtti demo: no example to open on' }

    /** @type {(name: string) => DemoExample} */
    const exampleOf = name => {
        const found = examples.find(e => e.name === name)
        if (found === undefined) { throw 'rtti demo: no example has this name' }
        return found
    }

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
     * The example drop-down, its options in their groups, when there is more
     * than one example to pick.
     *
     * @type {(picked: DemoExample) => readonly Element[]}
     */
    const pickerView = picked => examples.length < 2 ? [] : [
        ['p',
            ['label', { for: 'example' }, 'Example '],
            ['select', { id: 'example', name: 'example' },
                ...groups.map(([label, g]) =>
                    /** @type {Element} */(['optgroup', { label }, ...g.map(x => exampleOption(x, picked))])),
            ],
        ],
    ]

    /**
     * The comparison: a drop-down of every schema in the demo, and, when one
     * is picked, what the data form says of the shown schema and it. With no
     * other schema to pick, it is not drawn.
     *
     * @type {(s: DemoSchema, compare: string) => readonly Element[]}
     */
    const compareView = (s, compare) => {
        if (keyedSchemas.length < 2) { return [] }
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
                    ...groups.map(([label, g]) => /** @type {Element} */(['optgroup', { label }, ...options(g)])),
                ],
            ],
            ...(c === undefined ? [] : /** @type {readonly Element[]} */ ([
                ['p', c.verdict],
                ['pre', { [codeMarker]: '' }, c.calls],
            ])),
        ]
    }

    /**
     * The state on picking schema `shown` of a pair: compared with the other
     * one, the value kept as typed.
     *
     * @type {(state: DemoState, shown: 0 | 1) => DemoState}
     */
    const showing = (state, shown) => ({ ...state, shown, compare: partnerOf(exampleOf(state.example), shown) })

    return {
        init: picking(start),
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
            // The schema shown, then its graph — a picture of the schema, so
            // it sits by it and changes with the pick — what rtti derives from
            // it, the comparison, and the value with its answers last.
            const s = shown === 1 && b !== undefined ? b : a
            return ['div',
                ...pickerView(e),
                ['p', e.about],
                schemasView(e, shown),
                graphSvg(_graphOf(s.schema)),
                ...outputsView(s),
                ...compareView(s, compare),
                ...valueView(s, text),
            ]
        },
    }
}
