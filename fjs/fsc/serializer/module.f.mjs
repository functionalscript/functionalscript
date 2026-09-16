/**
 * The FunctionalScript writer: a linked EDAG in, a module the parser
 * accepts out, so that compiling the output again yields the same graph.
 *
 * ```text
 * Exp ==the analysis==> the table ==this writer==> FunctionalScript text
 * ```
 *
 * It is the output the language's own extension asks for, and the one that
 * can hold what the language accepts: DataJS has no functions, so a module
 * holding one has no `.data.js` and no `.json`, and until this writer it had
 * no output but the EDAG document, which describes the function as data
 * rather than being one
 * ([`../todo/functionalscript-output.md`](../todo/functionalscript-output.md)).
 *
 * **It writes the graph, not the value.** Nothing is executed, so a module
 * holding a function is written, and so is one whose value a reader would
 * refuse — a read of `null` is the program's failure to make when it runs.
 *
 * **What a `const` is for.** A node that mints identity — `[]`, `{}`, `=>` —
 * is one value however many edges reach it, and only a `const` keeps that in
 * text, so a shared one is hoisted. A node the analysis merged — an access —
 * is written in place at every occurrence instead, since the occurrences
 * merge again when the output is read: hoisting one would evaluate it where
 * the source did not. Every `const` is named by its position among the
 * statements, `$0` then `$1`, anchors and hoists in one sequence, so that one
 * graph is one text.
 *
 * **One line, normalized**, as the DataJS output is, and its leaves are the
 * DataJS serializer's, which owns their spelling.
 *
 * **What it refuses**, each by name and with nothing written: a node kind it
 * has no spelling for, which is how a feature that adds one is made to add
 * its spelling here in the same change; a comma anywhere but the root, which
 * has no source form until the operator lands; a shared constructor or a
 * hoisted base inside a function body, until a body has a `const` to hoist
 * into ([`3130-body-const.md`](../../../spec/todo/3130-body-const.md)); and a
 * key the parser would not read back — one no literal spells, and one naming
 * a property of a built-in prototype, which the grammar refuses in either
 * spelling.
 *
 * An identity-minting node reached only through lazy edges is refused too,
 * and needs no rule of its own yet: every lazy node kind is a kind this
 * writer has no spelling for, so such a graph is refused at the operator
 * before its sharing is reached.
 *
 * A graph that breaks the EDAG's own scope rule is not refused but throws,
 * out of the analysis, since it is no EDAG rather than one this writer
 * cannot spell.
 *
 * @module
 *
 * @import { Analysis, Node, Operand } from '../../edag/analysis/types.ts'
 * @import { Exp } from '../../edag/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Document } from './types.ts'
 * @import { _Hoisted, _Names, _Root, _Scope, _Statement } from './private.ts'
 */

import { analysis } from '../../edag/analysis/module.f.mjs'
import { keySerialize, leafSerialize } from '../../media/datajs/serializer/module.f.mjs'
import { arrayWrap, colon, objectWrap } from '../../media/json/serializer/module.f.mjs'
import { first, flat, toArray } from '../../types/list/module.f.mjs'
import { prohibitedNames } from '../parser/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'
import { error, mapOk, ok, okThen } from '../../types/result/module.f.mjs'

/** The node kinds a compiled graph holds and this writer spells. @type {(node: Node) => boolean} */
const minting = node => {
    switch (node[0]) {
        case '[]': case '{}': case '=>': { return true }
        default: { return false }
    }
}

/**
 * Whether a base needs a `const` of its own: the grammar takes no access on
 * a number, a bigint or a function, though linking puts all three there —
 * `n.x` with `n` exporting `1` is `['.', 1, 'x']`, which `1.x` cannot spell.
 *
 * @type {(a: Analysis, base: Operand) => boolean}
 */
const basedHoisted = (a, base) => base instanceof Array
    ? a.nodes[base[1]][0] === '=>'
    : typeof base === 'number' || typeof base === 'bigint'

/** Two hoisted values are one when they name the same entry, or the same primitive by `Object.is`. @type {(x: _Hoisted, y: _Hoisted) => boolean} */
const sameHoisted = (x, y) => x[0] === y[0] && Object.is(x[1], y[1])

/**
 * The name a hoisted value took, or `null` where it has none yet. A slot an
 * anchor's `const` took holds no value and matches nothing.
 *
 * @type {(names: _Names, h: _Hoisted) => string | null}
 */
const nameOf = (names, h) => {
    const i = names.findIndex(n => n !== null && sameHoisted(n, h))
    return i === -1 ? null : `$${i}`
}

/** The letters a parameter is named by, as a spreadsheet names its columns: `a`, `z`, `aa`. @type {(n: number) => string} */
const column = n => {
    const q = Math.floor((n - 1) / 26)
    return `${q === 0 ? '' : column(q)}${'abcdefghijklmnopqrstuvwxyz'[(n - 1) % 26]}`
}

/** The parameter of the body at `depth`, `1` being the outermost. @type {(depth: number) => string} */
const parameter = depth => `$${column(depth)}`

/** Whether a word may follow `.`, or must be written as a key in brackets. @type {(key: string) => boolean} */
const identifierKey = key => key.length !== 0
    && !'0123456789'.includes(key[0])
    && [...key].every(c => 'abcdefghijklmnopqrstuvwxyz'.includes(c.toLowerCase()) || '0123456789_$'.includes(c))

/**
 * The results of a list, or the first error in it. A list of values is
 * written only when every element is, and the refusal reported is the one
 * a reader meets first.
 *
 * @template T
 * @param {readonly Result<T, string>[]} xs
 * @returns {Result<readonly T[], string>}
 */
const every = xs => {
    const bad = xs.find(x => x[0] === 'error')
    return bad === undefined
        ? ok(xs.map(x => /** @type {readonly ['ok', T]} */(x)[1]))
        : error(/** @type {readonly ['error', string]} */(bad)[1])
}

/**
 * The text of an operand at `depth`, `0` at the module level: a primitive
 * as the DataJS serializer spells it, a hoisted value by its name, and any
 * other entry in place.
 *
 * @type {(s: _Scope, depth: number) => (v: Operand) => Document}
 */
const operand = (s, depth) => v => {
    if (!(v instanceof Array)) { return ok(leafSerialize(v)) }
    const name = nameOf(s.names, ['entry', v[1]])
    return name === null ? entry(s, depth)(v[1]) : ok([name])
}

/**
 * An access's base: a hoisted one by its name, anything else as an operand.
 * Inside a body a hoisted base is refused, since its `const` would move a
 * function's constructor to the module's scope and a number would be read
 * back as a capture.
 *
 * @type {(s: _Scope, depth: number) => (v: Operand) => Document}
 */
const base = (s, depth) => v => {
    if (!basedHoisted(s.a, v)) { return operand(s, depth)(v) }
    if (depth !== 0) { return error('a hoisted access base inside a function body') }
    const h = /** @type {_Hoisted} */ (v instanceof Array ? ['entry', v[1]] : ['leaf', v])
    // Every such base at the module level was collected before the statement
    // that needs it, so a missing name is this module's own mistake.
    return ok([assertNotNullish(nameOf(s.names, h), ['an access base that was not hoisted', v])])
}

/** An array's item: a spread has no source spelling. @type {(s: _Scope, depth: number) => (v: Operand | readonly ['...', Operand]) => Document} */
const item = (s, depth) => v => v instanceof Array && v[0] === '...'
    ? error('a spread')
    : operand(s, depth)(/** @type {Operand} */(v))

/** An object's entry: a spread has no source spelling, and a key that is not a string no literal. @type {(s: _Scope, depth: number) => (p: readonly [':', Operand, Operand] | readonly ['...', Operand]) => Document} */
const property = (s, depth) => p => {
    if (p[0] === '...') { return error('a spread') }
    const [, k, v] = p
    return typeof k !== 'string'
        ? error('an object key that is not a string')
        : mapOk(value => flat([keySerialize(k), colon, value]))(operand(s, depth)(v))
}

/** A key in brackets, `[k]`, where no word follows a `.`. @type {(k: string | number) => Document} */
const bracketed = k => ok(flat([['['], leafSerialize(k), [']']]))

/**
 * An access's key: a name after `.` where the word admits it, and a key in
 * brackets otherwise.
 *
 * A number is written as itself, except for the three the tokenizer does not
 * read back to the same key: `NaN` and either infinity have no literal at
 * all, `Infinity` being an identifier and no key token, and `-0` reads back
 * as `0`. The front end produces none of them — `a[-0]` is already the key
 * `0` by the time a graph holds it — so each is refused rather than
 * respelled.
 *
 * A computed key, `['Number', e]`, is refused rather than written
 * `base[Number(k)]` as the issue proposes: the grammar's index is a string
 * or a number literal, so that spelling is one the parser would not read
 * back, and writing it would break the round trip the output exists for. It
 * is a spelling to add with computed keys, not before them.
 *
 * @type {(k: Operand) => Document}
 */
const key = k => {
    if (typeof k === 'string') {
        if (prohibitedNames.has(k)) { return error('a prohibited property name') }
        return identifierKey(k) ? ok(['.', k]) : bracketed(k)
    }
    if (typeof k !== 'number') { return error('an access key that is no literal') }
    return Number.isFinite(k) && !Object.is(k, -0)
        ? bracketed(k)
        : error('a number key no literal reads back')
}

/** The first chunk of a document, which no spelling leaves empty. @type {(text: List<string>) => string} */
const firstChunk = first('')

/**
 * A function's body: a block where its text opens with `{`, since `=> {`
 * opens a block and not an object.
 *
 * The question is the text's and not the node's: an object literal is not
 * the only body that begins with one — `['.', ['{}', …], 'a']` writes
 * `{"a":1}.a` — and a body that begins with `{` any other way would need
 * the same block. `s` is the scope the body's text is written in.
 *
 * @type {(s: _Scope, depth: number) => (b: Operand) => Document}
 */
const lambdaBody = (s, depth) => b => mapOk(
    /** @type {(text: List<string>) => List<string>} */
    (text => firstChunk(text).startsWith('{') ? flat([['{return '], text, [';}']]) : text),
)(operand(s, depth)(b))

/**
 * One entry of the table, written in place. A shared constructor inside a
 * body has no `const` to keep it one value per call, so it is refused where
 * it stands.
 *
 * @type {(s: _Scope, depth: number) => (i: number) => Document}
 */
const entry = (s, depth) => i => {
    const node = s.a.nodes[i]
    if (depth !== 0 && minting(node) && s.a.shared.includes(i)) {
        return error('a shared constructor inside a function body')
    }
    switch (node[0]) {
        case 'undefined': { return ok(['undefined']) }
        case 'args': {
            return depth === 0 ? error('the arguments outside a function') : ok([parameter(depth)])
        }
        case '[]': { return mapOk(arrayWrap)(every(node[1].map(item(s, depth)))) }
        case '{}': { return mapOk(objectWrap)(every(node[1].map(property(s, depth)))) }
        case '.': {
            const [, b, k, continuation] = node
            if (continuation !== undefined) { return error('a chain step') }
            return mapOk(
                /** @type {(parts: readonly List<string>[]) => List<string>} */
                (parts => flat(parts)),
            )(every([base(s, depth)(b), key(k)]))
        }
        case '=>': {
            const [, frame, body] = node
            return frame !== null
                ? error('a function with a frame')
                : mapOk(
                    /** @type {(text: List<string>) => List<string>} */
                    (text => flat([[`(...${parameter(depth + 1)})=>`], text])),
                )(lambdaBody(s, depth + 1)(body))
        }
        case ',': { return error('a comma outside the root') }
        default: { return error(`a ${node[0]} node`) }
    }
}

/**
 * The values a statement has to hoist before it can be written, in the
 * order their `const`s come: every hoisted value its operand reaches and
 * the names do not hold yet, each after the hoisted values it reaches
 * itself, which is the table's own order since an entry follows its
 * operands.
 *
 * A body is not walked: nothing inside one is hoisted, because a `const`
 * at the module level would leave the body's scope.
 *
 * @type {(s: _Scope) => (v: Operand) => readonly _Hoisted[]}
 */
const hoists = s => {
    /** @type {(found: readonly _Hoisted[], v: Operand) => readonly _Hoisted[]} */
    const found = (names, v) => {
        /** @type {(ns: readonly _Hoisted[], h: _Hoisted) => readonly _Hoisted[]} */
        const add = (ns, h) =>
            nameOf(s.names, h) === null && nameOf(ns, h) === null ? [...ns, h] : ns
        if (!(v instanceof Array)) { return names }
        const i = v[1]
        if (nameOf(s.names, ['entry', i]) !== null) { return names }
        const node = s.a.nodes[i]
        const inner = operands(node).reduce(found, names)
        const self = minting(node) && s.a.shared.includes(i) ? add(inner, ['entry', i]) : inner
        return node[0] === '.' && basedHoisted(s.a, node[1])
            ? add(self, node[1] instanceof Array ? ['entry', node[1][1]] : ['leaf', /** @type {number | bigint} */(node[1])])
            : self
    }
    return v => found(/** @type {readonly _Hoisted[]} */([]), v)
}

/**
 * The operands a node holds, for the hoisting walk: a container's items and
 * a property's halves, an access's base and key, and a comma's operands. A
 * function's body is not among them, since the walk stops at a body.
 *
 * @type {(node: Node) => readonly Operand[]}
 */
const operands = node => {
    switch (node[0]) {
        case '[]': { return node[1].flatMap(x => x instanceof Array && x[0] === '...' ? [x[1]] : [/** @type {Operand} */(x)]) }
        case '{}': { return node[1].flatMap(p => p[0] === '...' ? [p[1]] : [p[1], p[2]]) }
        case '.': { return [node[1], node[2]] }
        case ',': { return node[1] }
        default: { return [] }
    }
}

/** The text a hoisted value's `const` holds. @type {(s: _Scope) => (h: _Hoisted) => Document} */
const hoistedText = s => h => h[0] === 'leaf'
    ? ok(leafSerialize(h[1]))
    : entry(s, 0)(h[1])

/**
 * One statement and every `const` it needed first: the hoists, in order,
 * then the operand itself — an anchor as a `const` of its own, and the last
 * operand as the export.
 *
 * @type {(a: Analysis, last: boolean) => (before: _Statement, v: Operand) => Result<_Statement, string>}
 */
const statement = (a, last) => ({ text, names }, v) => {
    /** @type {(acc: Result<_Statement, string>, h: _Hoisted) => Result<_Statement, string>} */
    const emit = (acc, h) => {
        if (acc[0] === 'error') { return acc }
        const before = acc[1]
        const s = { a, names: before.names }
        return mapOk(
            /** @type {(value: List<string>) => _Statement} */
            (value => ({
                text: flat([before.text, [`const $${before.names.length}=`], value, [';']]),
                names: [...before.names, h],
            })),
        )(hoistedText(s)(h))
    }
    const hoisted = hoists({ a, names })(v).reduce(emit, ok({ text, names }))
    if (hoisted[0] === 'error') { return hoisted }
    const before = hoisted[1]
    const s = { a, names: before.names }
    return mapOk(
        /** @type {(value: List<string>) => _Statement} */
        (value => ({
            text: flat([
                before.text,
                last ? ['export default '] : [`const $${before.names.length}=`],
                value,
                [';'],
            ]),
            names: last ? before.names : [...before.names, null],
        })),
    )(operand(s, 0)(v))
}

/**
 * The operands the module's statements are written from: a comma at the
 * root is the source form it came from, an unused `const` per anchor and
 * then the export, and any other root is the export alone.
 *
 * A root comma holding fewer than two operands is refused: an anchor is an
 * unreached `const`, so a comma with one operand has no anchor to write and
 * would be read back as its operand alone, and one with none is not a
 * module at all. Linking emits neither — a comma is built only where an
 * anchor or an unbound import is there to carry.
 *
 * @type {(a: Analysis) => Result<_Root, string>}
 */
const roots = a => {
    if (!(a.root instanceof Array)) { return ok([a.root]) }
    const node = a.nodes[a.root[1]]
    if (node[0] !== ',') { return ok([a.root]) }
    return node[1].length < 2
        ? error('a root comma with fewer than two operands')
        : ok(node[1])
}

/**
 * A linked EDAG as the chunks of a FunctionalScript module, or why this
 * writer has no spelling for it.
 *
 * @type {(e: Exp) => Document}
 */
export const trySerialize = e => {
    const a = analysis(e)
    /** @type {(all: _Root) => Document} */
    const written = all => {
        /** @type {(acc: Result<_Statement, string>, v: Operand, i: number) => Result<_Statement, string>} */
        const step = (acc, v, i) => acc[0] === 'error'
            ? acc
            : statement(a, i === all.length - 1)(acc[1], v)
        return mapOk(
            /** @type {(s: _Statement) => List<string>} */
            (s => s.text),
        )(all.reduce(step, ok({ text: null, names: [] })))
    }
    return okThen(written)(roots(a))
}

/** The same as one string. @type {(e: Exp) => Result<string, string>} */
export const tryStringify = e => mapOk(
    /** @type {(text: List<string>) => string} */
    (text => toArray(text).join('')),
)(trySerialize(e))
