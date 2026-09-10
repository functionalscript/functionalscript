/**
 * The DataJS reader: the rewrite set that folds the tree of the grammar in
 * `../../../ebnf/lib/datajs` into a value as the LL(1) backend builds it,
 * and {@link parse}, the reader over a whole document.
 *
 * ```text
 * DataJS text -> grammar -> parse -> Unknown
 * ```
 *
 * A mapping sees one value and no environment, so the fold builds a
 * {@link Node} per value — a leaf, a container of nodes, a reference by
 * name — and the names are resolved where the statements are read, after
 * the grammar has matched the whole document: each `const` binds its name
 * to its value, resolved against the names bound before it, and the export
 * is the document's value. That is what `spec/datajs/README.md` asks of
 * processing after grammar recognition — a plain string key decoding to
 * `__proto__` is refused, a name is bound at most once, and a reference
 * names a previously declared `const` — split at the environment: the key
 * rule needs none, so the fold applies it, a rejection standing where the
 * value would; the other two do, so the resolution applies them. An error
 * is the first met in document order; a parse that fails builds no tree
 * and reports where.
 *
 * The value denotes a graph: a reference resolves to the very node its
 * `const` bound, so `const $0=[];export default [$0,$0];` reads back as one
 * array in two slots, and every container written out is a node of its
 * own. Resolution walks a value over an explicit stack rather than the
 * call stack, so nesting depth stays the input's, as it is in the machine.
 *
 * The input is the UTF-16 alphabet of `../../../ebnf/utf16`, as JSON's is,
 * and a string is JSON's rule folded by JSON's mapping: a lone surrogate is
 * one unit in and one out, raw or escaped.
 *
 * @module
 *
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Ast, Children, Meta } from '../../../ebnf/ast/types.ts'
 * @import { Mappings, RewriteSet } from '../../../ebnf/ll1/types.ts'
 * @import { Utf16 } from '../../../ebnf/utf16/types.ts'
 * @import { Entry as EntryRule } from '../../../ebnf/lib/json/types.ts'
 * @import { DataJsValue } from '../../../ebnf/lib/datajs/types.ts'
 * @import { constStatement, property } from '../../../ebnf/lib/datajs/module.f.mjs'
 * @import { Primitive, Unknown } from '../types.ts'
 * @import { _Binding, _Env, _Frame, _Stack, _State } from './private.ts'
 * @import { Container, Entry, Node, Out, Value } from './types.ts'
 */

import { assert } from '../../../asserts/module.f.mjs'
import { concat, toArray } from '../../../types/list/module.f.mjs'
import { at, empty, setReplace } from '../../../types/ordered_map/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.mjs'
import { eof } from '../../../ebnf/module.f.mjs'
import { symbolAt, unmapped } from '../../../ebnf/ast/module.f.mjs'
import { mapping, parser } from '../../../ebnf/ll1/module.f.mjs'
import { units } from '../../../ebnf/utf16/module.f.mjs'
import { items } from '../../../ebnf/lib/json/module.f.mjs'
import { dataJs, number, value } from '../../../ebnf/lib/datajs/module.f.mjs'
import { lexeme, stringMappings, syntaxError } from '../../json/parser/module.f.mjs'

const { fromEntries } = Object

/** @type {(node: Node) => Meta<Value>} */
const valueSymbol = node => ({ symbol: 0, meta: { id: 'value', node } })

/** @type {(node: Meta<Utf16 | Out> | readonly unknown[]) => string} */
const textAt = node => {
    const { meta } = symbolAt(node)
    assert(meta.id === 'text')
    return meta.value
}

/** @type {(node: Meta<Utf16 | Out> | readonly unknown[]) => Node} */
const nodeAt = node => {
    const { meta } = symbolAt(node)
    assert(meta.id === 'value')
    return meta.node
}

const protoKey = /** @type {const} */ ('__proto__')

/**
 * The refusal of the plain spelling of the `__proto__` key, standing where
 * the member's value would.
 *
 * @type {Node}
 */
const protoRejected = ['error', `a "${protoKey}" key is spelled ["${protoKey}"]`]

/**
 * A number is what its branch spells: an infinity, signed; a bigint from the
 * integer form its `n` follows, `-0n` being `0n` as `BigInt` has it; and a
 * `number` from the whole lexeme otherwise, so `-0` keeps its sign and a
 * magnitude the finite range cannot hold is the infinity JavaScript reads.
 *
 * @type {(node: Children<typeof number, Utf16, Out>) => Primitive}
 */
const numberOf = node => {
    const [sign, unsigned] = node
    const branch = unmapped(unsigned)
    if (branch[0] === 'infinity') { return unmapped(sign).length === 0 ? Infinity : -Infinity }
    const [uint, suffix] = unmapped(branch[1])
    return unmapped(suffix)[0] === 'n' ? BigInt(lexeme([sign, uint])) : Number(lexeme(node))
}

/**
 * One member of an object: its key and its value. The computed spelling is
 * the `__proto__` key; a string is the key it decodes to, unless that is
 * `__proto__`, whose plain spelling is refused in every escaping — the
 * refusal in the value's place, where it is met in document order.
 *
 * @type {(node: Ast<EntryRule<typeof property, DataJsValue>, Utf16, Out>) => Entry}
 */
const member = node => {
    const [key, , , , v] = unmapped(node)
    const k = unmapped(key)
    if (k[0] === 'proto') { return [protoKey, nodeAt(v)] }
    const name = textAt(k[1])
    return [name, name === protoKey ? protoRejected : nodeAt(v)]
}

/**
 * A value is the node its branch made: a container of its items' nodes, a
 * string the text its mapping returned, a number the leaf its mapping
 * returned, a word its constant, and a reference the name it spells.
 *
 * @type {(node: Children<DataJsValue, Utf16, Out>) => Meta<Value>}
 */
const toNode = node => {
    switch (node[0]) {
        case 'array': { return valueSymbol(['array', items(unmapped(node[1])).map(nodeAt)]) }
        case 'object': { return valueSymbol(['object', items(unmapped(node[1])).map(member)]) }
        case 'string': { return valueSymbol(textAt(node[1])) }
        case 'number': { return valueSymbol(nodeAt(node[1])) }
        case 'true': { return valueSymbol(true) }
        case 'false': { return valueSymbol(false) }
        case 'null': { return valueSymbol(null) }
        case 'nan': { return valueSymbol(NaN) }
        case 'undefined': { return valueSymbol(undefined) }
        case 'id': { return valueSymbol(['ref', lexeme(node[1])]) }
    }
}

/** @type {Mappings<Utf16, Out>} */
const map = mapping

/**
 * The rewrite set: JSON's `string` mappings, a number to its leaf, and a
 * value to the node its branch made. Keyed by the rules
 * `../../../ebnf/lib/datajs` and `../../../ebnf/lib/json` hold, so that
 * `parser(dataJs, mappings)` yields a document whose every value is one
 * symbol carrying its node.
 *
 * @type {RewriteSet<Utf16, Out>}
 */
export const mappings = [
    ...stringMappings,
    map(number, node => valueSymbol(numberOf(node))),
    map(value, toNode),
]

/** @type {(container: Container, index: number) => Node} */
const itemAt = (container, index) =>
    container[0] === 'array' ? container[1][index] : container[1][index][1]

/**
 * A container of the values its items denote: an array, or an object with a
 * member per entry. `Object.fromEntries` gives the members the order the
 * format specifies — array-index keys first in numeric order, the rest as
 * written, a repeated key keeping its first position and taking its last
 * value — and a member whose value is `undefined` is present.
 *
 * @type {(container: Container, done: readonly Unknown[]) => Unknown}
 */
const close = (container, done) =>
    container[0] === 'array' ? done : fromEntries(container[1].map(([key], index) => [key, done[index]]))

/**
 * The value a node denotes under `env`, or the first error met in document
 * order: a reference to a name `env` does not bind, or a refusal the fold
 * left in a value's place.
 *
 * Over an explicit stack: a frame per container being built, its items
 * evaluated in order, so that a value nested as deep as the input allows
 * costs no call stack.
 *
 * @type {(env: _Env) => (root: Node) => Result<Unknown, string>}
 */
const evaluate = env => root => {
    /**
     * The next item of a container, or the container closed when none is
     * left.
     *
     * @type {(stack: _Stack, frame: _Frame) => _State}
     */
    const round = (stack, frame) => {
        const { container, index, done } = frame
        return index < container[1].length
            ? [{ top: frame, rest: stack }, ['enter', itemAt(container, index)]]
            : [stack, ok(close(container, toArray(done)))]
    }

    /** @type {(stack: _Stack, node: Node) => _State} */
    const enter = (stack, node) => {
        if (!(node instanceof Array)) { return [stack, ok(node)] }
        switch (node[0]) {
            case 'ref': {
                const binding = at(node[1])(env)
                return [stack, binding === null ? error(`unresolved reference ${node[1]}`) : ok(binding[0])]
            }
            case 'error': { return [stack, error(node[1])] }
            default: { return round(stack, { container: node, index: 0, done: null }) }
        }
    }

    /** @type {_State} */
    let state = [null, ['enter', root]]
    while (true) {
        const [stack, step] = state
        if (step[0] === 'enter') {
            state = enter(stack, step[1])
        } else if (step[0] === 'error' || stack === null) {
            return step
        } else {
            const { top, rest } = stack
            state = round(rest, { ...top, index: top.index + 1, done: concat(top.done)([step[1]]) })
        }
    }
}

/**
 * A `const` statement: the name it binds and the node of its value.
 *
 * @type {(node: Ast<typeof constStatement, Utf16, Out>) => readonly [name: string, node: Node]}
 */
const declaration = node => {
    const [, , name, , , , v] = unmapped(node)
    return [lexeme(name), nodeAt(v)]
}

/**
 * The statements of a document, in order: each `const` binds a name not yet
 * bound to its value, resolved against the names bound before it, and the
 * export is the document's value, resolved against them all. A `const` is
 * bound after its value, so `const $0=$0;` names nothing.
 *
 * @type {(node: Children<typeof dataJs, Utf16, Out>) => Result<Unknown, string>}
 */
const document = ([, declarations, exported]) => {
    /** @type {_Env} */
    let env = empty
    for (const statement of unmapped(declarations)) {
        const [name, node] = declaration(statement)
        if (at(name)(env) !== null) { return error(`duplicate const ${name}`) }
        const bound = evaluate(env)(node)
        if (bound[0] === 'error') { return bound }
        /** @type {_Binding} */
        const binding = [bound[1]]
        env = setReplace(name)(binding)(env)
    }
    return evaluate(env)(nodeAt(unmapped(exported)[4]))
}

/**
 * A document is the grammar's `dataJs` followed by the end of input, so
 * that what follows the export is refused rather than left: `dataJs` alone
 * stops where its rule does and would read `export default 1;2` as `1`.
 */
const wholeDocument = /**@type {const}*/([dataJs, eof])

const parseDocument = parser(wholeDocument, mappings)

/**
 * Parses a text as a DataJS document into the value it denotes.
 *
 * Returns `ok` with the value on success, or `error` with a message when
 * the text is no DataJS document: where the parse failed — `unexpected
 * end`, or `unexpected symbol at N` with `N` the code unit it stopped at —
 * or the first of the rules processing applies after recognition that the
 * document breaks, in document order.
 *
 * @type {(text: string) => Result<Unknown, string>}
 */
export const parse = text => {
    const match = parseDocument(units(text))
    return match[0] === 'error'
        ? error(syntaxError(text)(match[1]))
        : document(unmapped(unmapped(match[1][0])[0]))
}
