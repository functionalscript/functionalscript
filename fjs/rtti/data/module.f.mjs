/**
 * The serializable RTTI data form and the {@link toData} conversion from the
 * thunk form.
 *
 * A schema denotes a set of values. The data form partitions that set into
 * six disjoint kinds — unit values (`null`, `undefined`, `false`, `true`),
 * numbers, strings, bigints, arrays and objects — so that all schema algebra
 * (union normalization, coverage collapse, {@link equal}, {@link subset},
 * canonical ordering via {@link cmp}) reduces to kind-wise set operations.
 * {@link toData} is the single bridge from the thunk form; {@link validate}
 * is the data-driven counterpart of `../validate`. The form serializes as
 * DJS — plain JSON when no `bigint` literals are involved. See `./README.md`
 * for the design rationale and serialization notes, and `./types.ts` for the
 * type-level API.
 *
 * @module
 *
 * @import { Const, ConstObject, Type } from '../types.ts'
 * @import { Primitive, Unknown } from '../ts/types.ts'
 * @import { ResultE } from '../common/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { ArraySet, Data, KindSet, Node, ObjectSet, RuleSet, UnionSet } from './types.ts'
 * @import { _Assumed, _Ctx, _Key, _Keyed, _NodeMap, _State, _Thunk } from './private.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.mjs'
import { at, definedEntries, definedValues } from '../../types/object/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { eachEntry, isArray, undeclaredMembers, verror } from '../common/module.f.mjs'

/**
 * The unit kind's enumeration: bit `1 << i` of a {@link UnionSet}'s `unit`
 * bitset stands for `unitList[i]`.
 *
 * {@link absentBit} is the one `unit` bit with no `unitList` entry: absence
 * is not a DJS value, so it has nothing to enumerate here — see the bit's
 * own doc, and `UnionSet` in `./types.ts` for the serialized contract.
 */
export const unitList = /** @type {const} */ (['null', 'undefined', 'false', 'true'])

/**
 * The `unit` bit of one unit value.
 *
 * Value-keyed, so it cannot answer for {@link absentBit}: the absent bit has
 * no JS value to key on — absence is the member that is not there.
 *
 * @type {(v: null | undefined | boolean) => number}
 */
export const unitBit = v =>
    v === null ? 1 :
    v === undefined ? 2 :
    v ? 8 : 4

/**
 * The fifth `unit` bit: **absence**, rtti's nullary `option`. Not a member
 * of {@link unitList}, because it is not a DJS value — no value reads as
 * absent; a *container position* is absent by having no own or inherited
 * key. The set algebra does not care: union, `subset`, `cmp`, `equal` and
 * the coverage collapse are bitwise over the unit kind, so the bit rides
 * along. What does care is normalization — a `rest` never sees absence, so
 * an inline rest is stripped of the bit ({@link arraySet}/{@link objectSet})
 * — and the readers, which test it where a declared member is missing.
 */
export const absentBit = 16

const allUnits = unitBit(null) | unitBit(undefined) | unitBit(false) | unitBit(true)

const booleanUnits = unitBit(false) | unitBit(true)

/**
 * The data form of the empty set — rtti `never`.
 *
 * @type {UnionSet}
 */
export const never = {}

/**
 * The data form of the set of all values — rtti `unknown`.
 *
 * @type {UnionSet}
 */
export const unknown = {
    unit: allUnits,
    number: true,
    string: true,
    bigint: true,
    array: true,
    object: true,
}

/**
 * The union with the given unit bits removed — set subtraction restricted to
 * the unit kind. Dropping `undefined` from an optional property's value set is
 * the motivating case.
 *
 * The other five kinds are carried through untouched rather than copied field
 * by field. That is not only shorter: a caller that enumerates `UnionSet`'s
 * members to rebuild the node silently **drops** any kind added to the type
 * later, whereas spreading cannot. Removing every unit bit removes the `unit`
 * key entirely, since an empty kind is an absent property here, never a zero.
 *
 * @type {(bits: number) => (n: UnionSet) => UnionSet}
 */
export const withoutUnits = bits => n => {
    const unit = (n.unit ?? 0) & ~bits
    const { unit: _, ...rest } = n
    return unit === 0 ? rest : { unit, ...rest }
}

// ── canonical order ──────────────────────────────────────────────────────────

/** @type {(a: string, b: string) => number} */
const cmpString = (a, b) => a < b ? -1 : a > b ? 1 : 0

/**
 * Total order on number literals matching the SameValue equality the
 * validators use: ascending, `-0` before `0`, `NaN` last.
 *
 * @type {(a: number, b: number) => number}
 */
const cmpNumber = (a, b) => {
    if (Object.is(a, b)) { return 0 }
    if (Number.isNaN(a)) { return 1 }
    if (Number.isNaN(b)) { return -1 }
    if (a < b) { return -1 }
    if (a > b) { return 1 }
    // `a` and `b` are `+0` and `-0`, in one of the two orders
    return Object.is(a, -0) ? -1 : 1
}

/** @type {(a: bigint, b: bigint) => number} */
const cmpBigint = (a, b) => a < b ? -1 : a > b ? 1 : 0

/**
 * Lexicographic order, shorter lists first.
 *
 * @template T
 * @param {(a: T, b: T) => number} cmpItem
 * @returns {(a: readonly T[], b: readonly T[]) => number}
 */
const cmpList = cmpItem => (a, b) => {
    const d = a.length - b.length
    if (d !== 0) { return d }
    for (let i = 0; i < a.length; ++i) {
        const c = cmpItem(a[i], b[i])
        if (c !== 0) { return c }
    }
    return 0
}

/**
 * Order on one kind component: absent, then member lists, then `true`.
 *
 * @template T
 * @param {(a: T, b: T) => number} cmpItem
 * @returns {(a: KindSet<T> | undefined, b: KindSet<T> | undefined) => number}
 */
const cmpKind = cmpItem => (a, b) => {
    if (a === undefined) { return b === undefined ? 0 : -1 }
    if (b === undefined) { return 1 }
    if (a === true) { return b === true ? 0 : 1 }
    if (b === true) { return -1 }
    return cmpList(cmpItem)(a, b)
}

/**
 * @template T
 * @param {(a: T, b: T) => number} cmpValue
 * @returns {(a: readonly [string, T], b: readonly [string, T]) => number}
 */
const cmpEntry = cmpValue => ([ak, av], [bk, bv]) => {
    const c = cmpString(ak, bk)
    return c !== 0 ? c : cmpValue(av, bv)
}

/** @type {(a: Node | undefined, b: Node | undefined) => number} */
const cmpRest = (a, b) => {
    if (a === undefined) { return b === undefined ? 0 : -1 }
    if (b === undefined) { return 1 }
    return cmpNode(a, b)
}

/** @type {(a: ArraySet, b: ArraySet) => number} */
const cmpArraySet = (a, b) => {
    const c = cmpList(cmpNode)(a.prefix, b.prefix)
    return c !== 0 ? c : cmpRest(a.rest, b.rest)
}

/** @type {(a: ObjectSet, b: ObjectSet) => number} */
const cmpObjectSet = (a, b) => {
    const c = cmpList(cmpEntry(cmpNode))(definedEntries(a.props), definedEntries(b.props))
    return c !== 0 ? c : cmpRest(a.rest, b.rest)
}

/** @type {(a: UnionSet, b: UnionSet) => number} */
const cmpUnion = (a, b) => {
    const c0 = (a.unit ?? 0) - (b.unit ?? 0)
    if (c0 !== 0) { return c0 }
    const c1 = cmpKind(cmpNumber)(a.number, b.number)
    if (c1 !== 0) { return c1 }
    const c2 = cmpKind(cmpString)(a.string, b.string)
    if (c2 !== 0) { return c2 }
    const c3 = cmpKind(cmpBigint)(a.bigint, b.bigint)
    if (c3 !== 0) { return c3 }
    const c4 = cmpKind(cmpArraySet)(a.array, b.array)
    return c4 !== 0 ? c4 : cmpKind(cmpObjectSet)(a.object, b.object)
}

/**
 * Inline unions sort before references; references sort by rule name.
 *
 * @type {(a: Node, b: Node) => number}
 */
const cmpNode = (a, b) => {
    const bs = typeof b === 'string'
    return typeof a === 'string' ?
        (bs ? cmpString(a, b) : 1) :
        (bs ? -1 : cmpUnion(a, b))
}

/**
 * Total order over the data form: negative, zero or positive, with zero
 * exactly on structural identity. {@link toData} output is canonical, so two
 * conversions of equivalent thunk schemas compare equal — this is what makes
 * the data form comparable and sortable.
 *
 * @type {(a: Data) => (b: Data) => number}
 */
export const cmp = ([aRules, aNode]) => ([bRules, bNode]) => {
    const c = cmpNode(aNode, bNode)
    return c !== 0
        ? c
        : cmpList(cmpEntry(cmpUnion))(definedEntries(aRules), definedEntries(bRules))
}

/**
 * Structural equality of canonical forms: `equal(toData(a))(toData(b))`
 * holds exactly when `a` and `b` normalize to the same data — e.g.
 * `or(a, b)` and `or(b, a)` are equal. Recursive definitions compare by
 * their rule names, which are derived from the defining functions' names.
 *
 * @type {(a: Data) => (b: Data) => boolean}
 */
export const equal = a => b => cmp(a)(b) === 0

// ── kind-wise union ──────────────────────────────────────────────────────────

/**
 * Merges two sorted, deduplicated lists into one.
 *
 * @template T
 * @param {(a: T, b: T) => number} cmpItem
 * @returns {(a: readonly T[], b: readonly T[]) => readonly T[]}
 */
const mergeSorted = cmpItem => (a, b) => {
    if (a.length === 0) { return b }
    if (b.length === 0) { return a }
    const c = cmpItem(a[0], b[0])
    if (c < 0) { return [a[0], ...mergeSorted(cmpItem)(a.slice(1), b)] }
    if (c > 0) { return [b[0], ...mergeSorted(cmpItem)(a, b.slice(1))] }
    return [a[0], ...mergeSorted(cmpItem)(a.slice(1), b.slice(1))]
}

/**
 * Union of one kind component: absent = empty, `true` = the whole kind, so
 * `or(42, number)` collapses to all numbers here with no special-case rule.
 *
 * @template T
 * @param {(a: T, b: T) => number} cmpItem
 * @returns {(a: KindSet<T> | undefined, b: KindSet<T> | undefined) => KindSet<T> | undefined}
 */
const mergeKind = cmpItem => (a, b) => {
    if (a === undefined) { return b }
    if (b === undefined) { return a }
    if (a === true || b === true) { return true }
    return mergeSorted(cmpItem)(a, b)
}

/**
 * Kind-wise union of two union sets.
 *
 * @type {(a: UnionSet, b: UnionSet) => UnionSet}
 */
const merge = (a, b) => {
    const unit = (a.unit ?? 0) | (b.unit ?? 0)
    const number = mergeKind(cmpNumber)(a.number, b.number)
    const string = mergeKind(cmpString)(a.string, b.string)
    const bigint = mergeKind(cmpBigint)(a.bigint, b.bigint)
    const array = mergeKind(cmpArraySet)(a.array, b.array)
    const object = mergeKind(cmpObjectSet)(a.object, b.object)
    return {
        ...(unit === 0 ? {} : { unit }),
        ...(number === undefined ? {} : { number }),
        ...(string === undefined ? {} : { string }),
        ...(bigint === undefined ? {} : { bigint }),
        ...(array === undefined ? {} : { array }),
        ...(object === undefined ? {} : { object }),
    }
}

// ── canonical constructors ───────────────────────────────────────────────────

/** @type {(n: Node) => boolean} */
const isNever = n => typeof n !== 'string' && cmpUnion(n, never) === 0

/** @type {(n: Node) => boolean} */
const isTop = n => typeof n !== 'string' && cmpUnion(n, unknown) === 0

/**
 * The **declared-member** top: any value, or nothing — `or(option, unknown)`.
 * A declared position is where absence is observable, so its top carries the
 * absent bit; a `rest`'s top is plain {@link unknown}, a rest never seeing
 * an absent member.
 *
 * @type {UnionSet}
 */
const declaredTop = { ...unknown, unit: allUnits | absentBit }

/** @type {(n: Node) => boolean} */
const isDeclaredTop = n => typeof n !== 'string' && cmpUnion(n, declaredTop) === 0

/**
 * The node with the absent bit stripped — what a `rest` position normalizes
 * an **inline** union to, absence being unobservable there: a declared
 * member is checked as the value read at its position, but a `rest` is
 * checked against each *present* member, so the bit in a rest constrains
 * nothing. A **referenced** rest is left alone: the same rule may be used at
 * a declared position, where the bit is live, so clearing it globally would
 * delete optionality elsewhere — and the stripped form of a recursive rule
 * is a different fixpoint, not a bit-mask (see `./README.md`).
 *
 * @type {(n: Node) => Node}
 */
const stripAbsent = n =>
    typeof n === 'string' ? n : withoutUnits(absentBit)(n)

/**
 * The prefix with its redundant tail removed: a trailing declared position
 * that **admits absence** and whose absence-stripped set states exactly the
 * `rest` says nothing the `rest` does not already say.
 *
 * Every array carrying a value at that position is read against the same set
 * either way, so the two spellings can only differ on the arrays with
 * nothing there — one that ends before it, and one holding a hole at it.
 * Both are the position *absent*, which the position must admit for either
 * to belong; past the prefix a hole is no member, so the `rest` admits both
 * for free. That is why `{ prefix: [number], rest: number }` keeps its
 * position and stays "one or more numbers": `[]` and `[ , 1]` belong to
 * `{ prefix: [], rest: number }` and not to it.
 *
 * This is what keeps one set to one spelling: `rest([or(option, number)],
 * number)` and `array(number)` are both "arrays of numbers, any of which may
 * be a hole" and have to produce one `Node`.
 *
 * Two exemptions. A **referenced** trailing position is left alone — reading
 * its unit bits would need the rule set, and the form already declines to
 * see through a reference (see `./README.md`). And the trim never sees an
 * **empty** `rest` — {@link arraySet} returns the exact-length pattern
 * before trimming — which is what keeps `[option]` (its sole position
 * stripping to `never`, like the `rest`) distinct from `[]`: the two differ
 * on `new Array(1)`, a length the first admits and the second bounds out.
 *
 * @type {(prefix: readonly Node[], rest: Node) => readonly Node[]}
 */
const trimPrefix = (prefix, rest) => {
    if (typeof rest === 'string') { return prefix }
    /** @type {(n: Node) => boolean} */
    const redundant = n =>
        typeof n !== 'string'
        && ((n.unit ?? 0) & absentBit) !== 0
        && cmpUnion(withoutUnits(absentBit)(n), rest) === 0
    return prefix.slice(0, prefix.findLastIndex(n => !redundant(n)) + 1)
}

/**
 * Canonical array-kind singleton. A syntactically empty position makes the
 * whole pattern empty (nothing may be there and it may not be absent, so no
 * array has such a position — and none is short enough to escape it, a
 * missing index being absence); an inline `rest` is stripped of the absent
 * bit ({@link stripAbsent} — a rest never sees an absent member); an empty
 * `rest` admits nothing past the prefix, which is what no `rest` already
 * says; a prefix restating its `rest` is {@link trimPrefix}'d away; an
 * unconstrained `rest` with nothing left before it is every array.
 *
 * Every array set is stated with a `rest` — `never` for a bare tuple,
 * `unknown` for an `open` one, the element set for a uniform array — so this
 * takes one rather than an optional one; the absent `rest` is what it
 * normalizes an empty one *to*. `array(option)` is therefore the empty
 * array: its element set strips to `never`, and a `never` rest is the
 * exact-length pattern of its (empty) prefix.
 *
 * @type {(prefix: readonly Node[], rest: Node) => UnionSet}
 */
const arraySet = (prefix, rest0) => {
    const rest = stripAbsent(rest0)
    if (prefix.some(isNever)) { return never }
    if (isNever(rest)) { return { array: [{ prefix }] } }
    const p = trimPrefix(prefix, rest)
    return p.length === 0 && isTop(rest) ? { array: true } : { array: [{ prefix: p, rest }] }
}

/**
 * Canonical object-kind singleton. An inline `rest` is stripped of the
 * absent bit ({@link stripAbsent}); an unconstrained `rest` is the same set
 * as no `rest`; an unconstrained key is then dropped too; a syntactically
 * empty key set makes the whole pattern empty; with nothing left, the
 * pattern is every object.
 *
 * A key is dropped only once the `rest` is gone, and that order is the whole
 * rule: an undeclared key may be absent, or must belong to `rest`, which
 * leaves it unconstrained exactly when there is no `rest` — so with one
 * present a key saying "anything" says strictly more than leaving it out.
 * A bare struct's empty `rest` is where the two part company —
 * `{ props: { a: or(option, unknown) }, rest: never }` admits `{ a: 1 }` and
 * `{ props: {}, rest: never }` admits only `{}`.
 *
 * "Unconstrained", for a declared key, is {@link isDeclaredTop} — anything
 * *or nothing*, `or(option, unknown)` — not the plain top: a key declared
 * `unknown` must be present, which an undeclared key need not be, so
 * dropping it would widen the set.
 *
 * Like {@link arraySet}, every object set is stated with a `rest` — `never`
 * for a bare struct, `unknown` for an `open` one, the value set for a
 * uniform record — and the absent `rest` is what an unconstrained one
 * normalizes *to*.
 *
 * @type {(props: readonly (readonly [string, Node])[], rest: Node) => UnionSet}
 */
const objectSet = (props, rest0) => {
    const rest = stripAbsent(rest0)
    const r = isTop(rest) ? undefined : rest
    const constrained = r === undefined ? props.filter(([, v]) => !isDeclaredTop(v)) : props
    if (constrained.some(([, v]) => isNever(v))) { return never }
    if (constrained.length === 0 && r === undefined) { return { object: true } }
    /** @type {StringMap<Node>} */
    const sorted = Object.fromEntries(constrained.toSorted(([ak], [bk]) => cmpString(ak, bk)))
    return { object: [r === undefined ? { props: sorted } : { props: sorted, rest: r }] }
}

// ── subset ───────────────────────────────────────────────────────────────────

/** The rule sets of the two compared schemas: `[left, right]`. */
/**
 * Node pairs assumed included while they are being checked — the standard
 * coinductive treatment of reference cycles, keyed by {@link _Keyed} node
 * identities.
 */
/**
 * A node with a canonical identity for the coinductive memo: `r:<name>` a
 * rule reference, `u:<name>` a rule's object read-set (its rest plus
 * `undefined`), `t` the top set. A node synthesized from inline data has no
 * identity (`undefined`) — recursion through it descends its finite tree,
 * so every cycle still crosses identified pairs and the memo closes it.
 */
/**
 * Own-property lookups only: a `RuleSet`/`props` map is a plain object, so
 * reading through the prototype chain would return `Object.prototype`
 * members (`toString`, `constructor`, …) for names that are not defined.
 *
 * @type {(rules: RuleSet) => (n: Node) => UnionSet}
 */
const resolve = rules => n => typeof n === 'string' ? assertNotNullish(at(n)(rules)) : n

/** @type {<T>(a: T, b: T) => boolean} */
const strictEqual = (a, b) => a === b

/**
 * Inclusion of one kind component: every member of `a` below some member of
 * `b`; absent = empty, `true` = the whole kind.
 *
 * @template T
 * @param {(a: T, b: T) => boolean} le
 * @returns {(a: KindSet<T> | undefined, b: KindSet<T> | undefined) => boolean}
 */
const kindSubset = le => (a, b) => {
    if (a === undefined) { return true }
    if (b === true) { return true }
    if (a === true || b === undefined) { return false }
    return a.every(x => b.some(y => le(x, y)))
}

/**
 * Whether the node's set carries the absent bit, read through a reference
 * (own-property only).
 *
 * @type {(rules: RuleSet) => (n: Node) => boolean}
 */
const nodeAdmitsAbsence = rules => n =>
    ((resolve(rules)(n).unit ?? 0) & absentBit) !== 0

/**
 * Only the *longest* array each side admits is tested here — `pn` without a
 * `rest`, unbounded with one. The shortest needs no test of its own: a
 * position `q` insists on (one whose set excludes absence) is a position `p`
 * insists on too as soon as the per-position check below passes, which is
 * exactly what its absence-implication half states. Sound, and incomplete in
 * the way `subset` is elsewhere: a `p` shorter than `q` is answered `false`
 * even when every position past its end is one `q` admits as absent.
 *
 * A declared position asks the two questions the object kind asks of a key
 * ({@link objectSetSubset}): what `p` may hold there must be something `q`
 * holds there — the **absence-stripped** sets compared, absence not being a
 * value — and `p` may leave the position out only where `q` lets it, which
 * `q` does past its prefix (a hole there is no entry, so any `rest` admits
 * it) or where its own position carries the bit. A left position that is a
 * *reference* is compared unstripped — masking a reference is unsound, see
 * `./README.md` — so such a pair is answered `false` unless the right
 * carries the bit at that position: the accepted structural incompleteness.
 * `p`'s own `rest` needs neither question, a rest carrying no absent bit
 * after normalization.
 *
 * @type {(ctx: _Ctx) => (assumed: _Assumed) => (p: ArraySet, q: ArraySet) => boolean}
 */
const arraySetSubset = ctx => assumed => (p, q) => {
    const le = nodeSubset(ctx)(assumed)
    const pn = p.prefix.length
    const qn = q.prefix.length
    const lengthOk = q.rest !== undefined
        ? qn <= pn
        : p.rest === undefined && qn === pn
    if (!lengthOk) { return false }
    /** @type {(i: number) => Node} */
    const qAt = i => i < qn ? q.prefix[i] : assertNotNullish(q.rest)
    /** @type {(i: number) => boolean} */
    const qAdmitsAbsenceAt = i => i >= qn || nodeAdmitsAbsence(ctx[1])(q.prefix[i])
    return p.prefix.every((el, i) =>
            le(stripAbsent(el), qAt(i))
            && (typeof el === 'string'
                || ((el.unit ?? 0) & absentBit) === 0
                || qAdmitsAbsenceAt(i)))
        && (p.rest === undefined || le(p.rest, assertNotNullish(q.rest)))
}

/** @type {(n: Node) => _Keyed} */
const keyed = n => [n, typeof n === 'string' ? `r:${n}` : undefined]

/**
 * The set of values the pattern admits at key `k` when the key is **present**:
 * the declared set with its absent bit stripped, else the `rest`, else
 * anything.
 *
 * Presence is the whole point of splitting this from {@link objectMayOmit}:
 * this answers "what may be *present* at this key", that one answers whether
 * the key may be missing, and {@link objectSetSubset} asks both. Absence is
 * not a value, so a declared set's absent bit does not belong here — left
 * unstripped, the closed `{ a: or(option, number) }` tested
 * `(Absent | number) ⊆ number` against `record(number)` and answered `false`
 * though its only values are `{}` and `{ a: number }`, both of which
 * `record(number)` admits. A declared *reference* is kept unstripped —
 * masking a reference is unsound (see `./README.md`) — the same structural
 * incompleteness a referenced rest accepts.
 *
 * @type {(pattern: ObjectSet) => (k: string) => _Keyed}
 */
const objectPresentSet = pattern => k => {
    const n = at(k)(pattern.props)
    if (n !== null) { return keyed(stripAbsent(n)) }
    const { rest } = pattern
    return rest === undefined ? [unknown, 't'] : keyed(rest)
}

/**
 * Whether the pattern admits an object carrying no `k` at all: an undeclared
 * key may always be missing, and a declared one exactly when its set carries
 * the **absent bit**.
 *
 * The other half of the split — a local unit-bit test, so it needs no memo.
 *
 * @type {(rules: RuleSet) => (pattern: ObjectSet) => (k: string) => boolean}
 */
const objectMayOmit = rules => pattern => k => {
    const n = at(k)(pattern.props)
    return n === null || nodeAdmitsAbsence(rules)(n)
}

/** @type {(list: readonly string[]) => readonly string[]} */
const dedup = list => list.filter((n, i) => list.indexOf(n) === i)

/**
 * Every key either side declares is checked twice — what `p` may hold there
 * must be something `q` holds there, and `p` may leave it out only where `q`
 * lets it. Neither question implies the other: the first alone lets `p` admit
 * an object `q` rejects for a *missing* key, the second alone for a *present*
 * one.
 *
 * @type {(ctx: _Ctx) => (assumed: _Assumed) => (p: ObjectSet, q: ObjectSet) => boolean}
 */
const objectSetSubset = ctx => assumed => (p, q) => {
    const le = keyedSubset(ctx)(assumed)
    const keys = dedup([
        ...definedEntries(p.props).map(([k]) => k),
        ...definedEntries(q.props).map(([k]) => k),
    ])
    return keys.every(k =>
            le(objectPresentSet(p)(k), objectPresentSet(q)(k))
            && (!objectMayOmit(ctx[0])(p)(k) || objectMayOmit(ctx[1])(q)(k)))
        // values at the keys declared by neither side, which both may omit
        && (q.rest === undefined || nodeSubset(ctx)(assumed)(p.rest ?? unknown, q.rest))
}

/** @type {(ctx: _Ctx) => (assumed: _Assumed) => (a: UnionSet, b: UnionSet) => boolean} */
const unionSubset = ctx => assumed => (a, b) =>
    ((a.unit ?? 0) & ~(b.unit ?? 0)) === 0
    && kindSubset(Object.is)(a.number, b.number)
    && kindSubset(strictEqual)(a.string, b.string)
    && kindSubset(strictEqual)(a.bigint, b.bigint)
    && kindSubset(arraySetSubset(ctx)(assumed))(a.array, b.array)
    && kindSubset(objectSetSubset(ctx)(assumed))(a.object, b.object)

/** @type {(ctx: _Ctx) => (assumed: _Assumed) => (a: _Keyed, b: _Keyed) => boolean} */
const keyedSubset = ctx => assumed => ([a, aKey], [b, bKey]) => {
    let assumed1 = assumed
    if (aKey !== undefined && bKey !== undefined) {
        const inner = assumed[aKey]
        if (inner !== undefined && inner[bKey] === true) { return true }
        assumed1 = { ...assumed, [aKey]: inner === undefined ? { [bKey]: true } : { ...inner, [bKey]: true } }
    }
    return unionSubset(ctx)(assumed1)(resolve(ctx[0])(a), resolve(ctx[1])(b))
}

/** @type {(ctx: _Ctx) => (assumed: _Assumed) => (a: Node, b: Node) => boolean} */
const nodeSubset = ctx => assumed => (a, b) =>
    keyedSubset(ctx)(assumed)(keyed(a), keyed(b))

/**
 * Sound subset test: `true` means every value of `a` is a value of `b`.
 * Kind-wise on unions, pattern-wise on arrays/objects, coinductive on
 * reference cycles. Incomplete in the known-hard corners of semantic
 * subtyping (see `./README.md`): it may answer `false` for an inclusion
 * that only holds by distributing a union across positions, or one whose
 * left side is a non-syntactic empty set — never `true` for a non-inclusion.
 *
 * @type {(a: Data) => (b: Data) => boolean}
 */
export const subset = ([aRules, aNode]) => ([bRules, bNode]) =>
    nodeSubset([aRules, bRules])({})(aNode, bNode)

/**
 * Whether `a` and `b` denote the same set: {@link subset} both ways.
 *
 * Weaker as a test than {@link equal} and stronger as an answer. `equal`
 * compares canonical *structure*, so it reports two α-equivalent recursive
 * definitions — the same shape under different rule names — as different;
 * `subset` resolves references coinductively and sees through the renaming
 * (see `./README.md`). It inherits `subset`'s incompleteness in exchange: an
 * equality that holds only by distributing a union, or through a non-syntactic
 * empty set, is answered `false`. That direction is the safe one — a `false`
 * here never merges two memberships — so a caller may treat a `true` as
 * conclusive and a `false` as "not established".
 *
 * @type {(a: Data) => (b: Data) => boolean}
 */
export const equivalent = a => b => subset(a)(b) && subset(b)(a)

// ── coverage collapse ────────────────────────────────────────────────────────

/**
 * Drops every pattern subsumed by another pattern of the same list.
 *
 * Two *distinct* patterns can subsume each other: references to
 * α-equivalent rules under different names spell the same value set two
 * ways (e.g. `list` and a differently-named `X = readonly X[]`). A
 * mutually-subsumed pattern is therefore dropped only in favor of an
 * earlier one, keeping exactly the first member of each such group —
 * dropping on subsumption alone would drop the whole group.
 *
 * @template T
 * @param {(p: T, q: T) => boolean} le
 * @returns {(list: readonly T[]) => readonly T[]}
 */
const dropSubsumed = le => list =>
    list.filter((p, i) => !list.some((q, j) => j !== i && le(p, q) && (j < i || !le(q, p))))

/**
 * @template T
 * @param {(a: T, b: T) => number} cmpItem
 * @returns {(list: readonly T[]) => readonly T[]}
 */
const sortedDedup = cmpItem => list => {
    const sorted = list.toSorted(cmpItem)
    return sorted.filter((x, i) => i === 0 || cmpItem(sorted[i - 1], x) !== 0)
}

/** @type {(f: _NodeMap) => (p: ArraySet) => ArraySet} */
const mapArraySet = f => p => ({
    prefix: p.prefix.map(f),
    ...(p.rest === undefined ? {} : { rest: f(p.rest) }),
})

/** @type {(f: _NodeMap) => (p: ObjectSet) => ObjectSet} */
const mapObjectSet = f => p => ({
    props: Object.fromEntries(definedEntries(p.props).map(
        ([k, v]) => /** @type {const} */ ([k, f(v)]))),
    ...(p.rest === undefined ? {} : { rest: f(p.rest) }),
})

/**
 * Rewrites a union's nested nodes with `f`, keeping each pattern list
 * sorted and deduplicated.
 *
 * @type {(f: _NodeMap) => (u: UnionSet) => UnionSet}
 */
const mapChildren = f => u => ({
    ...u,
    ...(u.array === undefined || u.array === true ? {} : {
        array: sortedDedup(cmpArraySet)(u.array.map(mapArraySet(f))),
    }),
    ...(u.object === undefined || u.object === true ? {} : {
        object: sortedDedup(cmpObjectSet)(u.object.map(mapObjectSet(f))),
    }),
})

/**
 * Bottom-up node rewrite: children first, then `post` on every node.
 *
 * @type {(post: _NodeMap) => _NodeMap}
 */
const rewriteNodes = post => {
    /** @type {_NodeMap} */
    const go = n => post(typeof n === 'string' ? n : mapChildren(go)(n))
    return go
}

/**
 * Drops every subsumed array/object pattern of one union.
 *
 * @type {(ctx: _Ctx) => (u: UnionSet) => UnionSet}
 */
const dropSubsumedUnion = ctx => u => ({
    ...u,
    ...(u.array === undefined || u.array === true ? {} : {
        array: dropSubsumed(arraySetSubset(ctx)({}))(u.array),
    }),
    ...(u.object === undefined || u.object === true ? {} : {
        object: dropSubsumed(objectSetSubset(ctx)({}))(u.object),
    }),
})

/** @type {(ctx: _Ctx) => _NodeMap} */
const collapsePost = ctx => n => typeof n === 'string' ? n : dropSubsumedUnion(ctx)(n)

/**
 * The coverage collapse: every subsumed array/object pattern dropped,
 * recursively through inline nodes.
 *
 * @type {(ctx: _Ctx) => _NodeMap}
 */
const collapseNode = ctx => rewriteNodes(collapsePost(ctx))

/** @type {(ctx: _Ctx) => (u: UnionSet) => UnionSet} */
const collapseUnion = ctx => u => dropSubsumedUnion(ctx)(mapChildren(collapseNode(ctx))(u))

/**
 * Replaces a union structurally equal to a rule's body with a reference to
 * that rule (the alphabetically first one on a tie). This is what keeps
 * `or` idempotent over recursive schemas — the union of a rule with itself
 * is the rule's body, which reads back as the rule — and it also collapses
 * re-stated fixpoints such as `array(list)` for `list = readonly list[]`.
 *
 * @type {(rules: RuleSet) => _NodeMap}
 */
const internPost = rules => n => {
    if (typeof n === 'string') { return n }
    for (const [name, body] of definedEntries(rules)) {
        if (cmpUnion(n, body) === 0) { return name }
    }
    return n
}

/** @type {(rules: RuleSet) => _NodeMap} */
const internNode = rules => rewriteNodes(internPost(rules))

/** @type {(rules: RuleSet) => (u: UnionSet) => UnionSet} */
const internUnion = rules => mapChildren(internNode(rules))

/**
 * The final canonical step: interns rule-body copies in the entry and in
 * every rule body's nested positions. `rules` must already be sorted so a
 * tie between equal rule bodies resolves deterministically.
 *
 * @type {(rules: RuleSet, entry: Node) => Data}
 */
const internData = (rules, entry) => [
    Object.fromEntries(definedEntries(rules).map(
        ([n, u]) => /** @type {const} */ ([n, internUnion(rules)(u)]))),
    internNode(rules)(entry),
]

// ── toData ───────────────────────────────────────────────────────────────────

/** A thunk — the only schema form that can close a reference cycle. */
/** A schema tracked by identity: a thunk or a const container. */
/**
 * The first value associated with `key` by identity.
 *
 * @template K
 * @template T
 * @param {readonly (readonly [K, T])[]} list
 * @param {unknown} key
 * @returns {T | undefined}
 */
const assoc = (list, key) => {
    for (const [k, v] of list) {
        if (k === key) { return v }
    }
    return undefined
}

/**
 * The rule name of `t`, assigning a fresh one on first request — the
 * defining function's name, disambiguated with a counter on collision.
 *
 * @type {(state: _State, t: _Thunk) => readonly [_State, string]}
 */
const ensureName = (state, t) => {
    const existing = assoc(state.names, t)
    if (existing !== undefined) { return [state, existing] }
    const used = state.names.map(([, n]) => n)
    let name = t.name
    let i = 0
    while (used.some(n => n === name)) {
        name = t.name + i
        ++i
    }
    return [{ ...state, names: [...state.names, [t, name]] }, name]
}

/**
 * Records the pending merge `t ∪= op` and names `t`, so every embedding of
 * `t` stays a reference that late-binds to the final, merged union.
 *
 * @type {(state: _State, t: _Thunk, op: _Thunk) => _State}
 */
const defer = (state, t, op) => {
    const [state1] = ensureName(state, t)
    return { ...state1, deferred: [...state1.deferred, [t, op]] }
}

/** @type {(p: Primitive) => UnionSet} */
const primitiveUnion = p => {
    switch (typeof p) {
        case 'number': { return { number: [p] } }
        case 'string': { return { string: [p] } }
        case 'bigint': { return { bigint: [p] } }
        default: { return { unit: unitBit(p) } }
    }
}

/**
 * The union of a const container, memoized by identity.
 *
 * @type {(state: _State, c: ConstObject) => readonly [_State, UnionSet]}
 */
const containerMemo = (state, c) => {
    const done = assoc(state.done, c)
    if (done !== undefined) { return [state, done] }
    const [state1, u] = containerUnion(state, c, never)
    return [{ ...state1, done: [...state1.done, [c, u]] }, u]
}

/**
 * The union of a const container, with `rest` the set every member it does not
 * declare belongs to.
 *
 * Used bare, both kinds are **closed** — the declared members and no others —
 * so the default maps onto the `rest` that says so, `never` on either kind.
 * `rest`/`open` is what supplies one of its own; `unknown` is the open form,
 * which the two kinds spell differently in the canonical data (a tuple's
 * `rest: unknown`, a struct's absent `rest`) and {@link arraySet} /
 * {@link objectSet} normalize to.
 *
 * @type {(state: _State, c: ConstObject, rest: Node) => readonly [_State, UnionSet]}
 */
const containerUnion = (state, c, rest) => {
    let s = state
    if (c instanceof Array) {
        /** @type {readonly Node[]} */
        let prefix = []
        for (const item of c) {
            const [s1, n] = nodeOf(s)(item)
            s = s1
            prefix = [...prefix, n]
        }
        return [s, arraySet(prefix, rest)]
    }
    /** @type {readonly (readonly [string, Node])[]} */
    let props = []
    for (const [k, v] of Object.entries(c)) {
        const [s1, n] = nodeOf(s)(v)
        s = s1
        props = [...props, [k, n]]
    }
    return [s, objectSet(props, rest)]
}

/**
 * The union of a `rest` schema. The container is walked here rather than
 * through {@link containerMemo}: that memo is keyed by the container's
 * identity alone, and the same object with two different rests is two
 * different sets. The enclosing thunk is memoized by {@link convertThunk}
 * either way, so nothing is recomputed and a cycle through a `rest` still
 * closes.
 *
 * @type {(state: _State, c: ConstObject, r: Type) => readonly [_State, UnionSet]}
 */
const restUnion = (state, c, r) => {
    const [state1, restNode] = nodeOf(state)(r)
    return containerUnion(state1, c, restNode)
}

/** @type {(state: _State, c: Const) => readonly [_State, UnionSet]} */
const constUnion = (state, c) =>
    c !== null && typeof c === 'object'
        ? containerMemo(state, c)
        : [state, primitiveUnion(c)]

/**
 * The union of the `or` operands of `t`.
 *
 * A direct self-operand is skipped: `X = A ∪ X` collapses to `X = A`. An
 * operand whose union is not final — one still being converted (an ancestor
 * on the recursion stack), or a named rule with its own merges pending — is
 * {@link defer}red instead of merged eagerly.
 *
 * @type {(state: _State, t: _Thunk, operands: readonly Type[]) => readonly [_State, UnionSet]}
 */
const orUnion = (state, t, operands) => {
    let s = state
    let result = never
    for (const op of operands) {
        if (op === t) { continue }
        if (op === null || (typeof op !== 'object' && typeof op !== 'function')) {
            result = merge(result, primitiveUnion(op))
            continue
        }
        if (typeof op !== 'function') {
            const [s1, u] = containerMemo(s, op)
            s = s1
            result = merge(result, u)
            continue
        }
        if (s.converting.some(k => k === op)) {
            s = defer(s, t, op)
            continue
        }
        let u = assoc(s.done, op)
        if (u === undefined) {
            const [s1, u1] = convertThunk(s, op)
            s = s1
            u = u1
        }
        if (s.deferred.some(([target]) => target === op)) {
            s = defer(s, t, op)
        } else {
            result = merge(result, u)
        }
    }
    return [s, result]
}

/** @type {(state: _State, t: _Thunk) => readonly [_State, UnionSet]} */
const thunkUnion = (state, t) => {
    const [tag, ...rest] = t()
    switch (tag) {
        case 'const': {
            const [c] = rest
            assert(typeof c !== 'function', c)
            return constUnion(state, c)
        }
        case 'boolean': { return [state, { unit: booleanUnits }] }
        case 'number': { return [state, { number: true }] }
        case 'string': { return [state, { string: true }] }
        case 'bigint': { return [state, { bigint: true }] }
        case 'unknown': { return [state, unknown] }
        // An explicit case: the `default` arm below is `orUnion`, and a
        // nullary tag has an empty operand list, so without it
        // `toData(option)` would be the empty union — `never` — and
        // `toData(or(option, t))` would silently lose the bit.
        case 'option': { return [state, { unit: absentBit }] }
        case 'array': {
            const [state1, item] = nodeOf(state)(rest[0])
            return [state1, arraySet([], item)]
        }
        case 'record': {
            const [state1, value] = nodeOf(state)(rest[0])
            return [state1, objectSet([], value)]
        }
        case 'rest': {
            const [c, r] = rest
            assert(typeof c === 'object' && c !== null, c)
            return restUnion(state, c, r)
        }
        default: { return orUnion(state, t, rest) }
    }
}

/**
 * Computes and memoizes the union of a thunk.
 *
 * @type {(state: _State, t: _Thunk) => readonly [_State, UnionSet]}
 */
const convertThunk = (state, t) => {
    const [state1, u] = thunkUnion({ ...state, converting: [...state.converting, t] }, t)
    return [{
        ...state1,
        converting: state1.converting.filter(k => k !== t),
        done: [...state1.done, [t, u]],
    }, u]
}

/**
 * Converts a schema into a {@link Node} for a nested position: a reference
 * for named (recursive) thunks, an inline union for everything else.
 *
 * @type {(state: _State) => (t: Type) => readonly [_State, Node]}
 */
const nodeOf = state => t => {
    if (t === null || (typeof t !== 'object' && typeof t !== 'function')) {
        return [state, primitiveUnion(t)]
    }
    if (typeof t !== 'function') {
        return containerMemo(state, t)
    }
    const name = assoc(state.names, t)
    if (name !== undefined) { return [state, name] }
    const done = assoc(state.done, t)
    if (done !== undefined) { return [state, done] }
    if (state.converting.some(k => k === t)) {
        // a cycle: from here on, `t` is a named rule
        const [state1, name1] = ensureName(state, t)
        return [state1, name1]
    }
    const [state1] = convertThunk(state, t)
    return nodeOf(state1)(t)
}

/**
 * Applies the deferred merges until nothing changes. Every round only grows
 * unions with patterns drawn from the finite already-computed content, so
 * the loop terminates.
 *
 * @type {(state: _State) => readonly (readonly [_Key, UnionSet])[]}
 */
const fixpoint = state => {
    let done = state.done
    let changed = true
    while (changed) {
        changed = false
        for (const [target, source] of state.deferred) {
            const targetUnion = assertNotNullish(assoc(done, target))
            const merged = merge(targetUnion, assertNotNullish(assoc(done, source)))
            if (cmpUnion(merged, targetUnion) !== 0) {
                changed = true
                done = done.map(e => e[0] === target ? /** @type {const} */ ([target, merged]) : e)
            }
        }
    }
    return done
}

/** @type {(n: Node) => readonly string[]} */
const nodeRefs = n => typeof n === 'string' ? [n] : unionRefs(n)

/** @type {(rest: Node | undefined) => readonly string[]} */
const restRefs = rest => rest === undefined ? [] : nodeRefs(rest)

/** @type {(p: ArraySet) => readonly string[]} */
const arraySetRefs = p => [...p.prefix.flatMap(nodeRefs), ...restRefs(p.rest)]

/** @type {(p: ObjectSet) => readonly string[]} */
const objectSetRefs = p => [
    ...definedEntries(p.props).flatMap(([, v]) => nodeRefs(v)),
    ...restRefs(p.rest),
]

/**
 * @template T
 * @param {(p: T) => readonly string[]} f
 * @returns {(k: KindSet<T> | undefined) => readonly string[]}
 */
const kindRefs = f => k => k === undefined || k === true ? [] : k.flatMap(f)

/** @type {(u: UnionSet) => readonly string[]} */
const unionRefs = u => [...kindRefs(arraySetRefs)(u.array), ...kindRefs(objectSetRefs)(u.object)]

/**
 * All rule names reachable from `init` through rule bodies.
 *
 * @type {(rules: RuleSet, init: readonly string[]) => readonly string[]}
 */
const reachableFrom = (rules, init) => {
    let result = dedup(init)
    let frontier = result
    while (frontier.length !== 0) {
        const next = dedup(frontier
            .flatMap(n => unionRefs(assertNotNullish(rules[n])))
            .filter(n => !result.some(r => r === n)))
        result = [...result, ...next]
        frontier = next
    }
    return result
}

/** @type {(rules: RuleSet) => RuleSet} */
const sortRules = rules =>
    Object.fromEntries(definedEntries(rules).toSorted(([an], [bn]) => cmpString(an, bn)))

/**
 * Converts a thunk-form schema into its canonical data form.
 *
 * Runs once per consumer need; schemas that are built but never consumed pay
 * nothing. The output is normalized — unions are flattened and merged
 * kind-wise, literals are sorted and deduplicated, subsumed array/object
 * patterns are dropped, rules are pruned to the reachable set and sorted,
 * and a union equal to a rule's body reads back as a reference — so schema
 * identity is a property of this form: `toData(or(a, b))` and
 * `toData(or(b, a))` are structurally identical even though the two thunks
 * are distinct, and `or` is idempotent on recursive schemas.
 *
 * Only recursive definitions become named rules (named after their defining
 * functions), everything else is inlined; a schema with no reference cycles
 * converts to `[{}, unionSet]`.
 *
 * @type {(t: Type) => Data}
 */
export const toData = t => {
    /** @type {_State} */
    const empty = { converting: [], names: [], done: [], deferred: [] }
    const [state, node] = nodeOf(empty)(t)
    const done = fixpoint(state)
    const ruleEntries = done.flatMap(
        /** @returns {readonly (readonly [string, UnionSet])[]} */
        ([key, u]) => {
            const name = assoc(state.names, key)
            return name === undefined ? [] : [[name, u]]
        })
    /** @type {RuleSet} */
    const rules = Object.fromEntries(ruleEntries)
    /** @type {_Ctx} */
    const ctx = [rules, rules]
    /** @type {RuleSet} */
    const collapsed = Object.fromEntries(definedEntries(rules).map(
        ([n, u]) => /** @type {const} */ ([n, collapseUnion(ctx)(u)])))
    const entry = collapseNode(ctx)(node)
    const keep = reachableFrom(collapsed, nodeRefs(entry))
    /** @type {RuleSet} */
    const kept = Object.fromEntries(definedEntries(collapsed).filter(([n]) => keep.some(k => k === n)))
    if (typeof entry === 'string'
        && !definedValues(kept).some(u => unionRefs(u).some(r => r === entry))) {
        // the entry rule is not referenced by any rule body — inline it
        const entryUnion = assertNotNullish(kept[entry])
        /** @type {RuleSet} */
        const rest = Object.fromEntries(definedEntries(kept).filter(([n]) => n !== entry))
        return internData(sortRules(rest), entryUnion)
    }
    return internData(sortRules(kept), entry)
}

// ── data-driven validation ───────────────────────────────────────────────────

/** @type {(cond: boolean, value: Unknown) => ResultE} */
const checkValue = (cond, value) => cond ? ok(value) : verror('unexpected value')

/**
 * @template T
 * @param {(a: T, b: T) => boolean} eq
 * @returns {(k: KindSet<T> | undefined, v: T) => boolean}
 */
const kindHas = eq => (k, v) => k !== undefined && (k === true || k.some(x => eq(x, v)))

/** `validate` has nothing to collect from a successful entry — only pass/fail matters. */
const noAccumulate = () => undefined

/**
 * The first matching pattern wins; a single pattern's error is kept intact
 * (paths included), several candidates report `no match` like `or` does.
 *
 * @template T
 * @template {Unknown} V
 * @param {KindSet<T> | undefined} k
 * @param {(p: T) => (value: V) => ResultE} item
 * @param {V} value
 * @returns {ResultE}
 */
const patternsValidate = (k, item, value) => {
    if (k === undefined) { return verror('unexpected value') }
    if (k === true) { return ok(value) }
    if (k.length === 1) { return item(k[0])(value) }
    for (const p of k) {
        const r = item(p)(value)
        if (r[0] === 'ok') { return r }
    }
    return verror('no match')
}

/**
 * The declared positions are checked with absence decided **before**
 * dispatch — an index that is neither an own property nor an inherited one
 * is a missing member, legal exactly when its set carries the absent bit;
 * a present one is checked as the value read. No minimum length is tested
 * for: a too-short array is caught by the absence test at the first
 * position that excludes it. What is left over is tested against `rest`,
 * or, with no `rest`, must not be there at all. Same shape as
 * {@link objectSetValidate}, one kind over — and the same before-dispatch
 * test the schema-form readers make, so the three readers agree on `{}`
 * versus `{ a: undefined }` and on sparse tuples.
 *
 * `undeclaredMembers` is what the schema-form readers walk too, so "what is
 * left over" is one rule rather than two that happen to coincide — including
 * an index the prototype supplies, which an own-entry filter here answered
 * `ok` for while the rendered tail claimed the `rest`'s type over it.
 *
 * @type {(rules: RuleSet) => (p: ArraySet) => (value: readonly Unknown[]) => ResultE}
 */
const arraySetValidate = rules => p => value => {
    const pn = p.prefix.length
    const { rest } = p
    const declared = eachEntry(
        Object.entries(p.prefix),
        (k, n) => {
            if (!(k in value)) {
                return nodeAdmitsAbsence(rules)(n) ? ok(undefined) : verror('unexpected value')
            }
            const m = nodeValidate(rules)(n)(value[Number(k)])
            return m[0] === 'error' ? m : ok(undefined)
        },
        undefined,
        noAccumulate,
    )
    if (declared[0] === 'error') { return declared }
    const extra = undeclaredMembers(p.prefix.map((_, i) => String(i)), value)
    if (rest === undefined) {
        // Nothing past the prefix, by length as well as by entry: a hole past
        // it is not an entry, but the array is still that long, and this is
        // the set `Ts<>` renders as a tuple of exactly `pn` positions and JSON
        // Schema as `items: false`. A *shorter* array is another matter — the
        // declared loop above has already held every position it left unfilled
        // to a set admitting `undefined`.
        if (extra.length !== 0 || value.length > pn) {
            return verror('unexpected value')
        }
    } else {
        const r = eachEntry(extra, (_k, v) => nodeValidate(rules)(rest)(v), undefined, noAccumulate)
        if (r[0] === 'error') { return r }
    }
    return ok(value)
}

/** @type {(rules: RuleSet) => (p: ObjectSet) => (value: StringMap<Unknown>) => ResultE} */
const objectSetValidate = rules => p => value => {
    const declared = eachEntry(
        definedEntries(p.props),
        (k, n) => {
            if (!(k in value)) {
                return nodeAdmitsAbsence(rules)(n) ? ok(undefined) : verror('unexpected value')
            }
            const m = nodeValidate(rules)(n)(value[k])
            return m[0] === 'error' ? m : ok(undefined)
        },
        undefined,
        noAccumulate,
    )
    if (declared[0] === 'error') { return declared }
    const { rest } = p
    if (rest !== undefined) {
        const extra = eachEntry(
            Object.entries(value).filter(([k]) => at(k)(p.props) === null),
            (_k, v) => nodeValidate(rules)(rest)(v),
            undefined,
            noAccumulate,
        )
        if (extra[0] === 'error') { return extra }
    }
    return ok(value)
}

/** @type {(rules: RuleSet) => (u: UnionSet) => (value: Unknown) => ResultE} */
const unionValidate = rules => u => value => {
    if (typeof value === 'number') { return checkValue(kindHas(Object.is)(u.number, value), value) }
    if (typeof value === 'string') { return checkValue(kindHas(strictEqual)(u.string, value), value) }
    if (typeof value === 'bigint') { return checkValue(kindHas(strictEqual)(u.bigint, value), value) }
    if (value === null || value === undefined || typeof value === 'boolean') {
        return checkValue(((u.unit ?? 0) & unitBit(value)) !== 0, value)
    }
    if (isArray(value)) {
        return patternsValidate(u.array, arraySetValidate(rules), value)
    }
    return patternsValidate(u.object, objectSetValidate(rules), value)
}

/** @type {(rules: RuleSet) => (n: Node) => (value: Unknown) => ResultE} */
const nodeValidate = rules => n => unionValidate(rules)(resolve(rules)(n))

/**
 * Whether `r`, as the rest of the container `c`, admits nothing — so that
 * `rest(c, r)` and the bare, closed `c` denote one set.
 *
 * This is what the schema-form readers bound an array's length by, and it is
 * asked *here* on purpose: `arraySet` is where an empty rest normalizes away,
 * so the readers agree with this form by asking it rather than by re-deriving
 * the same rule and drifting. Stated as **making no difference to the
 * canonical form** — the conversion of `rest(c, r)` denoting the same set as
 * the conversion of `c` — and not as a judgement about `r` on its own, nor as
 * a reading of whether the conversion kept a `rest` key. Five cases fix it
 * between them, and only this equality satisfies all five:
 *
 * - `never`, `or()` and `[or()]` all convert `rest(c, r)` to `c`'s own
 *   conversion, so all three are empty. Keying on the exported `never` alone
 *   would pass a `never`-only proof with the other two spellings still
 *   disagreeing.
 * - `const r = () => ['rest', [r], never]` has no finite inhabitant, yet the
 *   conversion keeps `rest: "r"`, so it is *not* empty here. A reader
 *   recognizing that emptiness would start rejecting what this form accepts.
 * - `const a = () => ['or', b]; const b = () => ['or', a]` rules out the
 *   rest's *own* canonical data as the test: {@link toData} of `a` is `never`,
 *   and the conversion still keeps `rest: "a"`.
 * - `unknown` rules out "the conversion kept no `rest` key" as the test:
 *   `toData(rest([], unknown))` is `{ array: true }` — the whole kind, with no
 *   `rest` key — because a top rest collapses the pattern rather than being
 *   dropped from it.
 * - Two separately constructed copies of one recursive rule, one in `c` and
 *   one in `r`, rule out {@link equal} as the comparison: converting the rest
 *   reserves the name, so `c`'s rule is named `r0` where converting `c` alone
 *   names it `r`, and `equal` compares recursive definitions by rule name.
 *
 * {@link equivalent} answers all five. It is incomplete, and in the direction
 * that costs nothing here: an unrecognized empty rest leaves the length
 * unbounded, which is what a *kept* `rest` key means in this form anyway, so
 * the readers still agree with it.
 *
 * @type {(c: ConstObject, r: Type) => boolean}
 */
export const emptyRest = (c, r) =>
    equivalent(toData(/** @type {Type} */ (() => ['rest', c, r])))(toData(c))

/**
 * Data-driven validation — the counterpart of `../validate` that consumes a
 * {@link Data} produced by {@link toData} instead of walking the thunk
 * graph. Returns the original value on success, or the first
 * `{ path, message }` error.
 *
 * @type {(data: Data) => (value: Unknown) => ResultE}
 */
export const validate = ([rules, node]) => nodeValidate(rules)(node)
