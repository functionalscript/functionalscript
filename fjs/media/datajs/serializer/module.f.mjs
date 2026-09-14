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
 * `tryStringify` are what this module promises.
 *
 * @module
 *
 * @import { List } from '../../../types/list/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Primitive } from '../types.ts'
 * @import { _Graph, _Member, _Node, _Read, _Value } from './types.ts'
 * @import { _Frame, _Stack, _State, _Step, _Todo, _Walk } from './private.ts'
 */

import { assertNotNullish } from '../../../asserts/module.f.mjs'
import { serialize as bigintSerialize } from '../../../types/bigint/module.f.mjs'
import { empty, flat, toArray } from '../../../types/list/module.f.mjs'
import { cmp } from '../../../types/number/module.f.mjs'
import { error, mapOk, ok, okThen } from '../../../types/result/module.f.mjs'
import { add, empty as noneStarted, has } from '../../../types/set/module.f.mjs'
import { concat } from '../../../types/string/module.f.mjs'
import { arrayWrap, boolSerialize, colon, nullSerialize, objectWrap, stringSerialize } from '../../json/serializer/module.f.mjs'

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
 * the compiler's JSON output and its proofs' dump, in `fjs/fsc`, write
 * numbers the same way, and the rule has one owner; the `_` prefix says that
 * export is linkage rather than API, as it does for `_memberValue` below.
 *
 * @type {(value: number) => List<string>}
 */
export const _numberSerialize = value => [is(value, -0) ? '-0' : `${value}`]

/** @type {(value: Primitive) => List<string>} */
const leafSerialize = value => {
    switch (typeof value) {
        case 'boolean': { return boolSerialize(value) }
        case 'number': { return _numberSerialize(value) }
        case 'string': { return stringSerialize(value) }
        case 'bigint': { return [bigintSerialize(value)] }
        case 'undefined': { return undefinedSerialize }
        default: { return nullSerialize }
    }
}

const protoKey = '__proto__'

/**
 * A member's key as the document spells it. `__proto__` has one spelling,
 * the computed form: JavaScript reads `{"__proto__": v}` as an instruction
 * to replace the object's prototype, so a document spelling a member that
 * way would not read back the member it was given, and the reader refuses
 * it outright. This is the key seam
 * [157](../../../fsc/todo/157-json-djs-shared-value-machine.md) §2 counts,
 * and since the old `fjs/djs/serializer` was retired its only implementation.
 *
 * @type {(key: string) => List<string>}
 */
const keySerialize = key => key === protoKey
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

/** @type {_Walk} */
const start = { started: noneStarted, finished: empty }

/** @type {(value: Primitive) => _Value<object>} */
const leaf = value => ['leaf', value]

/** @type {(member: _Member<object>) => _Value<object>} */
const memberOf = ([, value]) => value

/** A value of the caller's, still to be read. @type {(value: unknown) => _Todo} */
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
 * @type {(value: object) => Result<_Frame, string>}
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
 * @type {(frame: _Frame) => _Node<object>}
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
 * @type {(stack: _Stack, walk: _Walk, frame: _Frame) => _State}
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
 * One value of the caller's: a leaf as it stands; a container as a node of
 * its own the first time it is met and a reference to that node every time
 * after, which is what carries the sharing; and anything outside the data
 * model refused where it is met.
 *
 * @type {(stack: _Stack, walk: _Walk, value: unknown) => _State}
 */
const enter = (stack, walk, value) => {
    switch (typeof value) {
        case 'bigint':
        case 'boolean':
        case 'number':
        case 'string':
        case 'undefined': { return [stack, walk, ok(leaf(value))] }
        case 'object': {
            if (value === null) { return [stack, walk, ok(leaf(null))] }
            if (has(value)(walk.started)) { return [stack, walk, ok(['ref', value])] }
            const frame = open(value)
            return frame[0] === 'error'
                ? [stack, walk, frame]
                : round(stack, { started: add(value)(walk.started), finished: walk.finished }, frame[1])
        }
        default: { return [stack, walk, error(`a ${typeof value} is not a DataJS value`)] }
    }
}

/**
 * The caller's value read into the graph, over an explicit stack: a frame
 * per container being read, its members read in order, so that a value
 * nested as deep as the reader accepts costs no call stack. The reader walks
 * the same way, which is what makes a document it accepts one this can
 * write back.
 *
 * @type {(value: unknown) => Result<_Step, string>}
 */
const read = value => {
    /** @type {_State} */
    let state = [null, start, ok(toEnter(value))]
    while (true) {
        const [stack, walk, next] = state
        if (next[0] === 'error') { return next }
        const todo = next[1]
        if (todo[0] === 'enter') {
            state = enter(stack, walk, todo[1])
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

/** The values a node holds, in the order it holds them. @type {<R>(node: _Node<R>) => readonly _Value<R>[]} */
const nodeValues = node => node.kind === 'array' ? node.items : node.members.map(([, value]) => value)

/** The nodes a node refers to. @type {(node: _Node<number>) => readonly number[]} */
const nodeRefs = node => nodeValues(node).flatMap(value => value[0] === 'ref' ? [value[1]] : [])

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
 * @type {(finished: readonly _Read[], root: _Value<object>) => Result<_Graph, string>}
 */
export const _link = (finished, root) => {
    const position = new Map(finished.map(
        /** @type {(entry: _Read, i: number) => readonly [object, number]} */
        (([value], i) => [value, i])
    ))
    /** @type {(value: _Value<object>) => _Value<number>} */
    const linkValue = value => value[0] === 'ref'
        ? ['ref', assertNotNullish(position.get(value[1]), 'a reference to a container that was never finished')]
        : value
    /** @type {(node: _Node<object>) => _Node<number>} */
    const linkNode = node => node.kind === 'array'
        ? { kind: 'array', items: node.items.map(linkValue) }
        : { kind: 'object', members: node.members.map(([key, value]) => [key, linkValue(value)]) }
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
 * @type {(graph: _Graph) => ReadonlySet<number>}
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
 * @type {(graph: _Graph) => ReadonlyMap<number, string>}
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
 * The document: a `const` per hoisted node, in post-order so that every
 * name is declared before it is used, and then the exported value.
 *
 * This pass needs no stack of its own, because `_link` left the nodes in
 * post-order: a node comes after every node it refers to, so the chunks of
 * each node are built, in index order, from the chunks of nodes already
 * built. A reference to a node written inline is a thunk over that node's
 * chunks, forced only as the document is read out — which the list's
 * iteration does without recursion — so nesting as deep as the reader
 * accepts costs no call stack here either.
 *
 * @type {(graph: _Graph) => List<string>}
 */
const write = graph => {
    const names = constNames(graph)
    /** @type {(value: _Value<number>) => List<string>} */
    const value = v => {
        if (v[0] === 'leaf') { return leafSerialize(v[1]) }
        const name = names.get(v[1])
        return name === undefined ? () => chunks[v[1]] : [name]
    }
    /** @type {(node: _Node<number>) => List<string>} */
    const inline = node => node.kind === 'array'
        ? arrayWrap(node.items.map(value))
        : objectWrap(node.members.map(([key, v]) => flat([keySerialize(key), colon, value(v)])))
    /** @type {readonly List<string>[]} */
    const chunks = graph.nodes.map(inline)
    const statements = [...names].map(([i, name]) => flat([[`const ${name}=`], chunks[i], [';']]))
    return flat([flat(statements), ['export default '], value(graph.root), [';']])
}

// ── entry points ──────────────────────────────────────────────────────────────

/**
 * A value of the caller's as the chunks of a DataJS document, or why it is
 * not one.
 *
 * Fallible by its name, because a caller may legitimately hand a writer a
 * value outside the data model, and the specification refuses such a value
 * rather than approximating it: a leaf outside the leaf set, a hole, a
 * symbol key, an accessor, a non-enumerable property, an array carrying
 * anything besides its elements, a non-plain object, or a cycle. What
 * `JSON.stringify` does with the same values — `null` for a function, `null`
 * for a hole, a symbol-keyed member dropped without a word — is the
 * silently wrong document this refuses instead.
 *
 * It takes no mapping over an object's members, which JSON's `serialize`
 * does: observable key order is part of a DataJS value, so a caller
 * reordering it would get back a valid document denoting a different
 * object.
 *
 * @type {(value: unknown) => Result<List<string>, string>}
 */
export const trySerialize = value => okThen(
    /** @type {(step: _Step) => Result<List<string>, string>} */
    (([walk, root]) => mapOk(write)(_link(toArray(walk.finished), root)))
)(read(value))

/**
 * {@link trySerialize} as one string: the document in normalized form, the
 * bytes a caller asks for to hash or compare documents.
 *
 * @type {(value: unknown) => Result<string, string>}
 */
export const tryStringify = value => mapOk(concat)(trySerialize(value))
