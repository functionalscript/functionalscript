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
 * that survive [`memberValue`](#memberValue). That also answers a question
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
 * The rules the specification states are each a function over data here —
 * `memberValue`, `elementNames`, `link` — and exported. That is what makes
 * them provable: no value FunctionalScript can build carries an accessor, a
 * non-enumerable property, an own property on an array besides its
 * elements, or a cycle, so a refusal reached only through such a value
 * could not be proved through this module's entry points at all.
 *
 * @module
 *
 * @import { List } from '../../../types/list/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Primitive } from '../types.ts'
 * @import { _Graph, _Member, _Node, _Read, _Value } from './types.ts'
 * @import { _Step, _Walk } from './private.ts'
 */

import { assertNotNullish } from '../../../asserts/module.f.mjs'
import { serialize as bigintSerialize } from '../../../types/bigint/module.f.mjs'
import { empty, flat, toArray } from '../../../types/list/module.f.mjs'
import { error, mapOk, ok, okThen } from '../../../types/result/module.f.mjs'
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

/**
 * Detects an array by the data model's boundary rather than by the
 * prototype chain: the specification serializes a `null`-prototype array
 * and an `Array` subclass instance as their data, and `instanceof Array` —
 * the spelling [`fjs/AGENTS.md`](../../../AGENTS.md) §3.1 otherwise calls
 * for — is `false` for the first of those.
 *
 * @type {(value: object) => value is readonly unknown[]}
 */
const isArray = /** @type {(value: object) => value is readonly unknown[]} */ (Array.isArray)

// ── leaves and keys ───────────────────────────────────────────────────────────

/** `undefined`, a DataJS leaf that JSON has no spelling for. @type {List<string>} */
const undefinedSerialize = ['undefined']

/**
 * A number as ECMAScript `ToString` spells it, which is the algorithm the
 * specification restates, with the one departure it names: `-0` is written
 * `-0` where `ToString` writes `0`. `NaN` and the infinities are words,
 * where JSON's `numberSerialize` writes `null` for them.
 *
 * @type {(value: number) => List<string>}
 */
const numberSerialize = value => [is(value, -0) ? '-0' : `${value}`]

/** @type {(value: Primitive) => List<string>} */
const leafSerialize = value => {
    switch (typeof value) {
        case 'boolean': { return boolSerialize(value) }
        case 'number': { return numberSerialize(value) }
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
 * it outright. `jsKeySerialize` in
 * [`fjs/djs/serializer`](../../../djs/serializer/module.f.mjs) is the same
 * rule for the same reason — the key seam
 * [157](../../../djs/todo/157-json-djs-shared-value-machine.md) §2 counts,
 * and the second implementation its extraction now has to answer for.
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
export const memberValue = (key, descriptor) =>
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
 * Exported for the same reason as {@link memberValue}: an array carrying an
 * own property besides its elements is not a value FunctionalScript can
 * build, but the names it would have are.
 *
 * @type {(names: readonly string[], length: number) => boolean}
 */
export const elementNames = (names, length) =>
    names.length === length + 1
    && names.every((name, i) => name === (i === length ? 'length' : `${i}`))

/** @type {_Walk} */
const start = { started: new Set(), finished: empty }

/** @type {(value: Primitive) => _Value<object>} */
const leaf = value => ['leaf', value]

/** @type {(member: _Member<object>) => _Value<object>} */
const memberOf = ([, value]) => value

/**
 * The node a finished container leaves behind, appended after every node it
 * refers to, and the reference standing in its place.
 *
 * @type {(value: object, node: _Node<object>) => (walk: _Walk) => _Step}
 */
const finish = (value, node) => walk => [
    { started: walk.started, finished: { head: walk.finished, tail: [[value, node]] } },
    ['ref', value],
]

/**
 * The members of one container, read in observable order: each own property
 * validated from its descriptor, and only the value of a property this
 * format can write followed.
 *
 * @type {(descriptors: readonly (readonly [string, PropertyDescriptor])[]) => (walk: _Walk) => Result<readonly [_Walk, readonly _Member<object>[]], string>}
 */
const readMembers = descriptors => walk => {
    let state = walk
    /** @type {List<_Member<object>>} */
    let members = empty
    for (const [key, descriptor] of descriptors) {
        const step = okThen(
            /** @type {(value: unknown) => Result<_Step, string>} */
            (value => read(value)(state))
        )(memberValue(key, descriptor))
        if (step[0] === 'error') { return step }
        const [next, value] = step[1]
        state = next
        members = { head: members, tail: [[key, value]] }
    }
    return ok([state, toArray(members)])
}

/**
 * A container met for the first time. Its kind is settled before its
 * descriptors are looked at, because descriptors cannot settle it: `new
 * Date()`, `new Map()`, `new Set()` and `new Number(1)` each carry zero own
 * property descriptors and zero own symbols, exactly as `{}` does, so
 * descriptor-only validation would find nothing to refuse and write any of
 * them as `{}` — a document denoting something else, silently. The check is
 * positive and closed instead: an array, or a plain object, whose prototype
 * is `Object.prototype` or `null`.
 *
 * @type {(value: object) => (walk: _Walk) => Result<_Step, string>}
 */
const readNode = value => walk => {
    if (getOwnPropertySymbols(value).length !== 0) { return error('an own symbol key') }
    const descriptors = getOwnPropertyDescriptors(value)
    if (isArray(value)) {
        const { length } = value
        const names = getOwnPropertyNames(value)
        if (!elementNames(names, length)) {
            return error('an array with a hole or an own property besides its elements')
        }
        /** @type {readonly (readonly [string, PropertyDescriptor])[]} */
        const elements = names.slice(0, length).map(name => [name, descriptors[name]])
        return mapOk(
            /** @type {(read: readonly [_Walk, readonly _Member<object>[]]) => _Step} */
            (([next, members]) => finish(value, { kind: 'array', items: members.map(memberOf) })(next))
        )(readMembers(elements)(walk))
    }
    const proto = getPrototypeOf(value)
    if (proto !== objectPrototype && proto !== null) { return error('a non-plain object') }
    return mapOk(
        /** @type {(read: readonly [_Walk, readonly _Member<object>[]]) => _Step} */
        (([next, members]) => finish(value, { kind: 'object', members })(next))
    )(readMembers(entries(descriptors))(walk))
}

/**
 * One value of the caller's, read into the graph: a leaf as it stands; a
 * container as a node of its own the first time it is met and a reference
 * to that node every time after, which is what carries the sharing; and
 * anything outside the data model refused where it is met.
 *
 * @type {(value: unknown) => (walk: _Walk) => Result<_Step, string>}
 */
const read = value => walk => {
    switch (typeof value) {
        case 'bigint':
        case 'boolean':
        case 'number':
        case 'string':
        case 'undefined': { return ok([walk, leaf(value)]) }
        case 'object': {
            if (value === null) { return ok([walk, leaf(null)]) }
            if (walk.started.has(value)) { return ok([walk, ['ref', value]]) }
            return readNode(value)({
                started: new Set([...walk.started, value]),
                finished: walk.finished,
            })
        }
        default: { return error(`a ${typeof value} is not a DataJS value`) }
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
export const link = (finished, root) => {
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
 * @type {(graph: _Graph) => ReadonlySet<number>}
 */
const shared = ({ nodes, root }) => {
    const refs = [root, ...nodes.flatMap(nodeValues)].flatMap(value => value[0] === 'ref' ? [value[1]] : [])
    return new Set(refs.filter((ref, i) => refs.indexOf(ref) !== i))
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
 * @type {(graph: _Graph) => List<string>}
 */
const write = graph => {
    const names = constNames(graph)
    /** @type {(value: _Value<number>) => List<string>} */
    const value = v => {
        if (v[0] === 'leaf') { return leafSerialize(v[1]) }
        const name = names.get(v[1])
        return name === undefined ? inline(graph.nodes[v[1]]) : [name]
    }
    /** @type {(node: _Node<number>) => List<string>} */
    const inline = node => node.kind === 'array'
        ? arrayWrap(node.items.map(value))
        : objectWrap(node.members.map(([key, v]) => flat([keySerialize(key), colon, value(v)])))
    const statements = [...names].map(([i, name]) => flat([[`const ${name}=`], inline(graph.nodes[i]), [';']]))
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
    (([walk, root]) => mapOk(write)(link(toArray(walk.finished), root)))
)(read(value)(start))

/**
 * {@link trySerialize} as one string: the document in normalized form, the
 * bytes a caller asks for to hash or compare documents.
 *
 * @type {(value: unknown) => Result<string, string>}
 */
export const tryStringify = value => mapOk(concat)(trySerialize(value))
