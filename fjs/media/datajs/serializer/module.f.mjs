/**
 * The DataJS writer: a value of the caller's, read into a graph and written
 * out as a document.
 *
 * ```text
 * unknown
 *    |
 *    v
 * read                      one traversal: classify, validate from property
 *    |                      descriptors, and read every container once
 *    v
 * link                      the host objects replaced by node indices, in
 *    |                      post-order; a reference forwards is a cycle
 *    v
 * write                     the shared nodes as `const` statements, then
 *    |                      `export default`
 *    v
 * DataJS text
 * ```
 *
 * **Nothing is read before it is known to be data.** Reading the caller's
 * graph means following its edges, and following an edge on an ordinary
 * enumerator reads the property — which invokes an enumerable getter, the
 * very effect the data model refuses. So `read` takes each container as its
 * own property descriptors and follows only the values of the descriptors
 * that survive [`_memberValue`](#_memberValue). That also answers a question
 * no type can: a descriptor exists exactly when the property does, so a
 * member holding `undefined` is a member, where an enumerator that drops it
 * would write a different object.
 *
 * **What comes out is normalized form** — one line, a single space after
 * `const`, `export` and `default` and nowhere else, a node hoisted into a
 * `const` exactly when more than one reference reaches it, and the consts
 * named `$0`, `$1`, … in the order they are emitted. A caller that wants a
 * readable layout is the reason the specification leaves layout free, and
 * is what would make a second writer worth having; there is one today, so
 * it is the one whose bytes are pinned.
 *
 * Both passes keep the reader's depth contract: the read walks an explicit
 * stack, a frame per container, and the write reads the linked graph in the
 * post-order `_link` left it in, so nesting as deep as the reader accepts
 * costs no call stack on the way back out. Neither squares the number of
 * containers: the containers entered are a persistent set with a
 * logarithmic add, and the shared nodes are read off sorted occurrences.
 *
 * The rules the specification states are each a function over data here —
 * `_memberValue`, `_elementNames`, `_link` — and exported. That is what makes
 * them provable: no value FunctionalScript can build carries an accessor, a
 * non-enumerable property, an own property on an array besides its
 * elements, or a cycle, so a refusal reached only through such a value
 * could not be proved through this module's entry points at all. The three
 * carry the `_` prefix because that export is linkage rather than API
 * ([`fjs/AGENTS.md`](../../../AGENTS.md) §3.2): `trySerialize` and
 * `tryStringify` are what this module promises, and `tryJsonSerialize` and
 * `tryJsonStringify` beside them — a JSON document is the tree a DataJS
 * graph unfolds to, so its writer is this read under JSON's leaf rule, and
 * lives here rather than in `fjs/media/json`, which this module imports.
 *
 * @module
 *
 * @import { List } from '../../../types/list/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Primitive, Unknown } from '../types.ts'
 * @import { _Graph, _Leaf, _Member, _Node, _Read, _Value } from './types.ts'
 * @import { _Frame, _Stack, _State, _Step, _Todo, _Walk } from './private.ts'
 */

import { assertNotNullish } from '../../../asserts/module.f.mjs'
import { serialize as bigintSerialize } from '../../../types/bigint/module.f.mjs'
import { empty, flat, toArray } from '../../../types/list/module.f.mjs'
import { cmp } from '../../../types/number/module.f.mjs'
import { error, mapOk, ok, okThen } from '../../../types/result/module.f.mjs'
import { add, empty as noneStarted, has } from '../../../types/set/module.f.mjs'
import { concat } from '../../../types/string/module.f.mjs'
import { arrayWrap, boolSerialize, colon, leafSerialize as leafSerializeWith, nullSerialize, objectWrap, stringSerialize } from '../../json/serializer/module.f.mjs'

const {
    entries,
    getOwnPropertyDescriptors,
    getOwnPropertyNames,
    getOwnPropertySymbols,
    getPrototypeOf,
    is,
    prototype: objectPrototype,
} = Object

// ── leaves and keys ───────────────────────────────────────────────────────────

/** `undefined`, a DataJS leaf that JSON has no spelling for. @type {List<string>} */
const undefinedSerialize = ['undefined']

/**
 * A number as ECMAScript `ToString` spells it, which is the algorithm the
 * specification restates, with the one departure it names: `-0` is written
 * `-0` where `ToString` writes `0`. `NaN` and the infinities are words,
 * where JSON's `numberSerialize` writes `null` for them. Exported because
 * the compiler's JSON output and its proofs' dump, in `fjs/compiler`, write
 * numbers the same way, and the rule has one owner; the `_` prefix says that
 * export is linkage rather than API, as it does for `_memberValue` below.
 *
 * @type {(value: number) => List<string>}
 */
export const _numberSerialize = value => [is(value, -0) ? '-0' : `${value}`]

/**
 * A leaf as a document spells it — this format's counterpart to JSON's
 * `stringSerialize` and `numberSerialize`, and public as those are: the
 * FunctionalScript writer in `fjs/compiler` spells the leaves of its own
 * documents this way, DataJS's leaves being FunctionalScript's, and the
 * rule has one owner.
 *
 * @type {(value: Primitive) => List<string>}
 */
export const leafSerialize = leafSerializeWith(_numberSerialize)({
    bigint: value => [bigintSerialize(value)],
    undefined: () => undefinedSerialize,
})

const protoKey = '__proto__'

/**
 * A member's key as the document spells it. `__proto__` has one spelling,
 * the computed form: JavaScript reads `{"__proto__": v}` as an instruction
 * to replace the object's prototype, so a document spelling a member that
 * way would not read back the member it was given, and the reader refuses
 * it outright. This is the key seam
 * [157](../../json/todo/157-json-djs-shared-value-machine.md) counts,
 * and since the old `fjs/djs/serializer` was retired its only implementation.
 *
 * Public beside {@link leafSerialize}, and for the same reason: the
 * FunctionalScript writer spells an object's key this way too.
 *
 * @type {(key: string) => List<string>}
 */
export const keySerialize = key => key === protoKey
    ? flat([['['], stringSerialize(key), [']']])
    : stringSerialize(key)

// ── reading the caller's value ────────────────────────────────────────────────

/**
 * The value of an own property this format can write, or why it cannot
 * write it. An accessor is refused because reading a getter is an effect,
 * and a non-enumerable property because writing the object without it would
 * denote a different object — the two attributes that decide *which values
 * appear at all*. Every other attribute is outside the data model and no
 * grounds for refusal: `writable` and `configurable` are not read here, so
 * a frozen value serializes as its data, as the specification requires.
 *
 * Exported because this is where the refusals can be proved. A descriptor
 * is ordinary data, where an object carrying an accessor or a
 * non-enumerable property is not a value FunctionalScript can build.
 *
 * @type {(key: string, descriptor: PropertyDescriptor) => Result<unknown, string>}
 */
export const _memberValue = (key, descriptor) =>
    descriptor.enumerable !== true ? error(`${key} is a non-enumerable property`) :
    !('value' in descriptor) ? error(`${key} is an accessor property`) :
    ok(descriptor.value)

/**
 * Whether an array's own property names are exactly its elements and its
 * `length`: the indices `0 … length - 1` in order, then `length`. A hole
 * leaves one of those names out, and any other own property adds one —
 * these are names rather than keys, so a non-enumerable extra is caught
 * here too. The specification refuses both, the second because array syntax
 * holds elements and has nowhere to put `const a=[1]; a.meta=2`'s `meta`.
 *
 * Exported for the same reason as {@link _memberValue}: an array carrying an
 * own property besides its elements is not a value FunctionalScript can
 * build, but the names it would have are.
 *
 * @type {(names: readonly string[], length: number) => boolean}
 */
export const _elementNames = (names, length) =>
    names.length === length + 1
    && names.every((name, i) => name === (i === length ? 'length' : `${i}`))

/** @type {_Walk<never>} */
const start = { started: noneStarted, finished: empty }

/** A leaf as the leaf rule kept it. @type {<L>(kept: L) => _Value<object, L>} */
const leaf = kept => ['leaf', kept]

/** @type {<L>(member: _Member<object, L>) => _Value<object, L>} */
const memberOf = ([, value]) => value

/** A value of the caller's, still to be read. @type {(value: unknown) => _Todo<never>} */
const toEnter = value => ['enter', value]

/**
 * A container met for the first time, opened as a frame. Its kind is
 * settled before its descriptors are looked at, because descriptors cannot
 * settle it: `new Date()`, `new Map()`, `new Set()` and `new Number(1)` each
 * carry zero own property descriptors and zero own symbols, exactly as `{}`
 * does, so descriptor-only validation would find nothing to refuse and
 * write any of them as `{}` — a document denoting something else, silently.
 * The check is positive and closed instead: an array, or a plain object,
 * whose prototype is `Object.prototype` or `null`. What the frame holds is
 * the properties the read will follow, in observable order; each is
 * validated from its descriptor when its turn comes, so that a refusal is
 * the first one in that order.
 *
 * @type {<L>(value: object) => Result<_Frame<L>, string>}
 */
const open = value => {
    if (getOwnPropertySymbols(value).length !== 0) { return error('an own symbol key') }
    const descriptors = getOwnPropertyDescriptors(value)
    if (value instanceof Array) {
        const { length } = value
        const names = getOwnPropertyNames(value)
        if (!_elementNames(names, length)) {
            return error('an array with a hole or an own property besides its elements')
        }
        /** @type {readonly (readonly [string, PropertyDescriptor])[]} */
        const properties = names.slice(0, length).map(name => [name, descriptors[name]])
        return ok({ value, kind: 'array', properties, index: 0, done: empty })
    }
    const proto = getPrototypeOf(value)
    if (proto !== objectPrototype && proto !== null) { return error('a non-plain object') }
    return ok({ value, kind: 'object', properties: entries(descriptors), index: 0, done: empty })
}

/**
 * The node a frame closes into once every member is read.
 *
 * @type {<L>(frame: _Frame<L>) => _Node<object, L>}
 */
const close = ({ kind, done }) => {
    const members = toArray(done)
    return kind === 'array' ? { kind, items: members.map(memberOf) } : { kind, members }
}

/**
 * The next member of a frame, its descriptor validated as its turn comes and
 * only the value of a property this format can write followed — or, when
 * none is left, the frame closed: its node appended after every node it
 * refers to, and the reference standing in its place handed down.
 *
 * @type {<L>(stack: _Stack<L>, walk: _Walk<L>, frame: _Frame<L>) => _State<L>}
 */
const round = (stack, walk, frame) => {
    const { value, properties, index } = frame
    if (index < properties.length) {
        const [key, descriptor] = properties[index]
        return [{ top: frame, rest: stack }, walk, mapOk(toEnter)(_memberValue(key, descriptor))]
    }
    return [
        stack,
        { started: walk.started, finished: { head: walk.finished, tail: [[value, close(frame)]] } },
        ok(['ref', value]),
    ]
}

/**
 * One value of the caller's: a leaf as the leaf rule keeps it where it is
 * met, or refused there; a container as a node of its own the first time it
 * is met and a reference to that node every time after, which is what
 * carries the sharing; and anything outside the data model refused where it
 * is met. So a refusal is the first one in the reader's order — a container
 * reached twice met once — whichever rule refuses it.
 *
 * @template L
 * @param {_Leaf<L>} leafRule
 * @returns {(stack: _Stack<L>, walk: _Walk<L>, value: unknown) => _State<L>}
 */
const enter = leafRule => (stack, walk, value) => {
    switch (typeof value) {
        case 'bigint':
        case 'boolean':
        case 'number':
        case 'string':
        case 'undefined': { return [stack, walk, mapOk(leaf)(leafRule(value))] }
        case 'object': {
            if (value === null) { return [stack, walk, mapOk(leaf)(leafRule(null))] }
            if (has(value)(walk.started)) { return [stack, walk, ok(['ref', value])] }
            /** @type {Result<_Frame<L>, string>} */
            const frame = open(value)
            return frame[0] === 'error'
                ? [stack, walk, frame]
                : round(stack, { started: add(value)(walk.started), finished: walk.finished }, frame[1])
        }
        default: { return [stack, walk, error(`a ${typeof value} is not a DataJS value`)] }
    }
}

/**
 * The caller's value read into the graph, each leaf kept as the leaf rule
 * keeps it where the read meets it, over an explicit stack: a frame per
 * container being read, its members read in order, so that a value nested
 * as deep as the reader accepts costs no call stack. The reader walks the
 * same way, which is what makes a document it accepts one this can write
 * back.
 *
 * @template L
 * @param {_Leaf<L>} leafRule
 * @returns {(value: unknown) => Result<_Step<L>, string>}
 */
const read = leafRule => value => {
    const enterWith = enter(leafRule)
    /** @type {_State<L>} */
    let state = [null, start, ok(toEnter(value))]
    while (true) {
        const [stack, walk, next] = state
        if (next[0] === 'error') { return next }
        const todo = next[1]
        if (todo[0] === 'enter') {
            state = enterWith(stack, walk, todo[1])
        } else if (stack === null) {
            return ok([walk, todo])
        } else {
            const { top, rest } = stack
            const [key] = top.properties[top.index]
            state = round(rest, walk, { ...top, index: top.index + 1, done: { head: top.done, tail: [[key, todo]] } })
        }
    }
}

// ── linking, sharing and writing ──────────────────────────────────────────────

/** The values a node holds, in the order it holds them. @type {<R, L>(node: _Node<R, L>) => readonly _Value<R, L>[]} */
const nodeValues = node => node.kind === 'array' ? node.items : node.members.map(([, value]) => value)

/** The nodes a node refers to. @type {<L>(node: _Node<number, L>) => readonly number[]} */
const nodeRefs = node => nodeValues(node).flatMap(value => value[0] === 'ref' ? [value[1]] : [])

/** A value with its reference, if any, replaced by the index of the node it refers to. @type {(position: ReadonlyMap<object, number>) => <L>(value: _Value<object, L>) => _Value<number, L>} */
const linkValueBy = position => value => value[0] === 'ref'
    ? ['ref', assertNotNullish(position.get(value[1]), 'a reference to a container that was never finished')]
    : value

/** @type {(position: ReadonlyMap<object, number>) => <L>(node: _Node<object, L>) => _Node<number, L>} */
const linkNodeBy = position => {
    const linkValue = linkValueBy(position)
    return node => node.kind === 'array'
        ? { kind: 'array', items: node.items.map(linkValue) }
        : { kind: 'object', members: node.members.map(([key, value]) => [key, linkValue(value)]) }
}

/**
 * The graph the read produced, with every reference to a host object
 * replaced by the index of that object's node — and refused where a node
 * refers to itself or to a node finished after it, which is what a cycle is
 * here. A container finishes after every container reachable from it, so in
 * an acyclic graph every reference points backwards; a reference to a
 * container still being read is the one that cannot, and it is the back
 * edge a cycle is.
 *
 * Exported because a cycle is not a value FunctionalScript can build, where
 * a graph carrying one is ordinary data.
 *
 * @type {<L>(finished: readonly _Read<L>[], root: _Value<object, L>) => Result<_Graph<L>, string>}
 */
export const _link = (finished, root) => {
    const position = new Map(finished.map(
        /** @type {(entry: readonly [object, unknown], i: number) => readonly [object, number]} */
        (([value], i) => [value, i])
    ))
    const linkValue = linkValueBy(position)
    const linkNode = linkNodeBy(position)
    const nodes = finished.map(([, node]) => linkNode(node))
    return nodes.every((node, i) => nodeRefs(node).every(ref => ref < i))
        ? ok({ nodes, root: linkValue(root) })
        : error('a cycle')
}

/**
 * The nodes a document has to hoist into a `const`: those more than one
 * reference occurrence reaches, counted by occurrence rather than by
 * root-to-node path. For `root=[p,p]` with `p=[c]`, `p` has two occurrences
 * and `c` has one, so `c` stays inline even though two paths reach it — an
 * implementation counting paths gets that wrong and passes the simple
 * cases. Leaves are never counted: the specification declines to hoist
 * them, and counting them by value would raise the `0`/`-0` and `NaN`
 * questions the `Object.is` guarantee forbids answering.
 *
 * The occurrences are sorted and a repeat is a neighbour equal to the one
 * before it, so the count costs a sort rather than an `indexOf` per
 * occurrence.
 *
 * @type {<L>(graph: _Graph<L>) => ReadonlySet<number>}
 */
const shared = ({ nodes, root }) => {
    const refs = [root, ...nodes.flatMap(nodeValues)]
        .flatMap(value => value[0] === 'ref' ? [value[1]] : [])
        .toSorted((a, b) => cmp(a)(b))
    return new Set(refs.filter((ref, i) => i > 0 && refs[i - 1] === ref))
}

/**
 * The name of each hoisted node. The nodes are in post-order, so taking
 * them in index order takes them in the order their consts are emitted,
 * which is the order `$0`, `$1`, … names them in.
 *
 * @type {<L>(graph: _Graph<L>) => ReadonlyMap<number, string>}
 */
const constNames = graph => {
    const hoisted = shared(graph)
    return new Map(graph.nodes
        .flatMap((_, i) => hoisted.has(i) ? [i] : [])
        .map(
            /** @type {(i: number, n: number) => readonly [number, string]} */
            ((i, n) => [i, `$${n}`])
        ))
}

/**
 * The chunks of every node and of any value of a graph, each leaf spelled
 * by `spellLeaf` from what the read kept, a hoisted node written as its
 * name and every other reference as a thunk over its node's chunks.
 *
 * This pass needs no stack of its own, because `_link` left the nodes in
 * post-order: a node comes after every node it refers to, so the chunks of
 * each node are built, in index order, from the chunks of nodes already
 * built. A reference to a node written inline is a thunk over that node's
 * chunks, forced only as the document is read out — which the list's
 * iteration does without recursion — so nesting as deep as the reader
 * accepts costs no call stack here either.
 *
 * @template L
 * @param {(key: string) => List<string>} key
 * @returns {(spellLeaf: (kept: L) => List<string>) => (names: ReadonlyMap<number, string>) => (graph: _Graph<L>) => { readonly chunks: readonly List<string>[], readonly value: (value: _Value<number, L>) => List<string> }}
 */
const chunksOf = key => spellLeaf => names => ({ nodes }) => {
    /** @type {(value: _Value<number, L>) => List<string>} */
    const value = v => {
        if (v[0] === 'leaf') { return spellLeaf(v[1]) }
        const name = names.get(v[1])
        return name === undefined ? () => chunks[v[1]] : [name]
    }
    /** @type {(node: _Node<number, L>) => List<string>} */
    const inline = node => node.kind === 'array'
        ? arrayWrap(node.items.map(value))
        : objectWrap(node.members.map(([k, v]) => flat([key(k), colon, value(v)])))
    /** @type {readonly List<string>[]} */
    const chunks = nodes.map(inline)
    return { chunks, value }
}

/**
 * The DataJS read's leaf rule: a leaf kept as it is, refused never. The
 * leaves are spelled by {@link write}, once `_link` has refused a cycle, so
 * a value refused for its graph costs no spelling — of a large string least
 * of all.
 *
 * @type {_Leaf<Primitive>}
 */
const kept = ok

/** A leaf a tree document's read already spelled. @type {(chunks: List<string>) => List<string>} */
const spelled = chunks => chunks

/**
 * The document: a `const` per hoisted node, in post-order so that every
 * name is declared before it is used, and then the exported value, the
 * leaves spelled here from the linked graph.
 *
 * @type {(graph: _Graph) => List<string>}
 */
const write = graph => {
    const names = constNames(graph)
    const { chunks, value } = chunksOf(keySerialize)(leafSerialize)(names)(graph)
    const statements = [...names].map(([i, name]) => flat([[`const ${name}=`], chunks[i], [';']]))
    return flat([flat(statements), ['export default '], value(graph.root), [';']])
}

/**
 * The tree a graph unfolds to, as a document with no `const`: a node
 * reached by more than one reference is written where each reaches it, as
 * `JSON.stringify` writes the same value. Nothing is hoisted, so no name
 * is needed and every reference is a thunk over its node's chunks; the
 * leaves were spelled by the read.
 *
 * @type {(key: (key: string) => List<string>) => (graph: _Graph<List<string>>) => List<string>}
 */
const writeTree = key => graph => chunksOf(key)(spelled)(new Map())(graph).value(graph.root)

// ── entry points ──────────────────────────────────────────────────────────────

/**
 * A value of the data model as the chunks of a DataJS document, or why it
 * is not one.
 *
 * The parameter is `Unknown`, the data model's own type, so a
 * FunctionalScript caller cannot hand this a value outside the model and
 * `tsc` says so at the call. The refusals stay, because the type cannot see
 * everything the specification refuses — a hole, a symbol key, an accessor,
 * a non-enumerable property, an array carrying anything besides its
 * elements, a non-plain object, a cycle — and a host that casts is refused
 * rather than approximated. What `JSON.stringify` does with the same values
 * — `null` for a function, `null` for a hole, a symbol-keyed member dropped
 * without a word — is the silently wrong document this refuses instead.
 *
 * It takes no mapping over an object's members, which JSON's `serialize`
 * does: observable key order is part of a DataJS value, so a caller
 * reordering it would get back a valid document denoting a different
 * object.
 *
 * @type {(value: Unknown) => Result<List<string>, string>}
 */
export const trySerialize = value => okThen(
    /** @type {(step: _Step<Primitive>) => Result<List<string>, string>} */
    (([walk, root]) => mapOk(write)(_link(toArray(walk.finished), root)))
)(read(kept)(value))

/**
 * A value of the data model as the chunks of a tree document — JSON's
 * shape, under a spelling of a leaf and of a key — or why it is not one.
 * The value is read into the same graph {@link trySerialize} reads it
 * into, each leaf spelled by the rule where the read meets it, and the
 * tree is written only then, a node reached twice written where each
 * reference reaches it as `JSON.stringify` writes it. That order is the
 * point: a leaf the rule refuses is found over the graph, which may be
 * exponentially smaller than the tree it unfolds to, so a document that
 * will not be written costs no unfolding; and the leaf refused is the
 * first in the reader's order, a node reached twice met once, so
 * `[undefined, [1n]]` names `undefined` under JSON's rule. What the data
 * model refuses, `trySerialize` refuses here too.
 *
 * @type {(leaf: _Leaf) => (key: (key: string) => List<string>) => (value: Unknown) => Result<List<string>, string>}
 */
const treeSerialize = leaf => key => value => okThen(
    /** @type {(step: _Step<List<string>>) => Result<List<string>, string>} */
    (([walk, root]) => mapOk(writeTree(key))(_link(toArray(walk.finished), root)))
)(read(leaf)(value))

/**
 * Why a value cannot be written as JSON. The wording names the thing JSON
 * has no spelling for, because that is the whole reason: nothing here is
 * malformed, and the same value writes as a DataJS document without
 * complaint.
 *
 * @type {(what: string) => Result<never, string>}
 */
const noJson = what => error(`no JSON spelling for ${what}`)

/**
 * A leaf in JSON, or the refusal. `undefined`, a bigint and the three
 * non-finite numbers are refused rather than approximated: `JSON.stringify`
 * writes `null` for `NaN` and drops an `undefined` member, and the extended
 * codec would write `1n` as `1`, which the standard reader takes back as
 * the *number* `1` — each a different value read back without a word. A
 * finite number is written by the DataJS rule, which is `ToString` with
 * `-0` kept, since `-0` is a JSON number that `JSON.stringify` alone loses.
 *
 * @type {_Leaf}
 */
const jsonLeaf = value => {
    switch (typeof value) {
        case 'boolean': { return ok(boolSerialize(value)) }
        case 'string': { return ok(stringSerialize(value)) }
        case 'number': { return isFinite(value) ? ok(_numberSerialize(value)) : noJson(`${value}`) }
        case 'bigint': { return noJson(`${value}n`) }
        case 'undefined': { return noJson('undefined') }
        default: { return ok(nullSerialize) }
    }
}

/**
 * A value of the data model as the chunks of a JSON document, or why it
 * has none: the tree the value unfolds to, under {@link jsonLeaf} and JSON's
 * own spelling of a key — `__proto__` included, which a DataJS document
 * alone has to spell computed. JSON carries no identity, so a node two
 * references reach is written where each reaches it, as `JSON.stringify`
 * writes the same value; what JSON cannot spell is refused rather than
 * approximated, the first such leaf in the reader's order named, and what
 * the data model refuses is refused as {@link trySerialize} refuses it.
 *
 * @type {(value: Unknown) => Result<List<string>, string>}
 */
export const tryJsonSerialize = treeSerialize(jsonLeaf)(stringSerialize)

/**
 * {@link tryJsonSerialize} as one string: what `fjs compile` writes for a
 * `.json` output.
 *
 * @type {(value: Unknown) => Result<string, string>}
 */
export const tryJsonStringify = value => mapOk(concat)(tryJsonSerialize(value))

/**
 * {@link trySerialize} as one string: the document in normalized form, the
 * bytes a caller asks for to hash or compare documents.
 *
 * @type {(value: Unknown) => Result<string, string>}
 */
export const tryStringify = value => mapOk(concat)(trySerialize(value))
