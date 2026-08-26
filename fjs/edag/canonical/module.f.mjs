/**
 * The chain conditions `validate` cannot state.
 *
 * A `lambdas` is `array(lambda)`, and neither `array(T)` nor `or` says
 * anything about cardinality or order, so the three conditions that bound
 * the two walkers — `_` and `_()` in `../module.f.mjs` — live here instead,
 * as a pass over a whole graph. `validate(exp)` accepts what this rejects;
 * a lowering must satisfy both.
 *
 * The conditions, in the order `canonical` reports them:
 *
 * 1. **Cardinality.** `_` holds at least two steps, `_()` at least one.
 *    Without this a walker respells a pure node: `['_', a, [['|.', b]]]`
 *    respells `a.b`, and `['_()', a, [['|.', b]], c]` respells `a.b(...c)`.
 *    The other half of the condition — at least one optional step — is not a
 *    test of its own: it follows from the front cut below, which passes only
 *    when the first step is optional or the second one is.
 * 2. **Minimality**, the shortest valid form: where an expression can be
 *    split into two, it is split. The walk is cut at **every** available cut
 *    point and only what cannot be cut survives, which shows up here as
 *    three tests — one per place a cut is available. Cardinality alone would
 *    admit four families of duplicate spellings; see `ChainMessage` in
 *    `./types.ts` for what each test rejects and why.
 *
 * One consequence bounds the shape rather than describing a procedure: a
 * `lambdas` holds at most one `|?.`, first if at all. A `|?.` consumes no
 * receiver — it is a property access, not a call — so nothing binds it to
 * the step before it and closing there is never observable, `?.` being
 * guarded itself. Every other guarded step is a `|?.()`, either opening the
 * region or bound to the property step ahead of it.
 *
 * Like `validate`, this is not identity-aware: a shared subgraph is walked
 * once per incoming edge. See `../../types/rtti/todo/identity-aware-parse.md`.
 *
 * @module
 *
 * @import { Exp, Items, Lambda, Lambdas, Properties } from '../types.ts'
 * @import { ChainError, ChainMessage } from './types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { error, ok } from '../../types/result/module.f.mjs'

/** A step that opens a short-circuit region. @type {(l: Lambda) => boolean} */
const optionStep = ([id]) => id === '|?.' || id === '|?.()'

/**
 * A step that leaves a receiver — for a following call step, or for `_()`'s
 * own call.
 * @type {(l: Lambda) => boolean}
 */
const propertyStep = ([id]) => id === '|.' || id === '|?.'

/**
 * Whether the region opens where it must: on the first step, or on the
 * second when a `|.` supplies the receiver a `|?.()` consumes. That `|.` is
 * the one step that cannot leave through the front, because the cut would
 * strand the receiver — `['?.()', ['.', a, b], c]` calls a detached `a.b`.
 * Everything else ahead of the region is a dead prefix and belongs in the
 * base, where it is a shareable `exp`.
 * @type {(l: Lambdas) => boolean}
 */
const opens = ([first, second]) =>
    optionStep(first) ||
    (first[0] === '|.' && second !== undefined && second[0] === '|?.()')

/**
 * Whether every optional step past the first is bound to the property step
 * ahead of it. A cut is available before any optional step that takes no
 * receiver from its predecessor, since the operator following the closure is
 * itself guarded; a `|?.()` after a property step has no such cut, because
 * an `exp` boundary yields a value rather than a reference.
 * @type {(l: Lambdas) => boolean}
 */
const uncut = l => l.slice(1).every(
    (step, i) => !optionStep(step) || (step[0] === '|?.()' && propertyStep(l[i])))

/** @type {(node: Exp) => (message: ChainMessage) => readonly ChainError[]} */
const one = node => message => [{ node, message }]

/**
 * The conditions of one walker: `min` is its cardinality bound, and `calls`
 * says whether the node's own call consumes the last step's receiver.
 * @type {(node: Exp, l: Lambdas, min: number, calls: boolean) => readonly ChainError[]}
 */
const walker = (node, l, min, calls) => {
    const e = one(node)
    if (l.length < min) { return e('too few steps') }
    if (!opens(l)) { return e('a dead prefix before the region') }
    if (!uncut(l)) { return e('a cut inside the region') }
    const [last] = l.slice(-1)
    return calls && !propertyStep(last) ? e('a trailing call step') : []
}

/** @type {(i: Items) => readonly Exp[]} */
const itemChildren = i => i instanceof Array && i[0] === '...' ? [i[1]] : [i]

/** @type {(p: Properties) => readonly Exp[]} */
const propertyChildren = p => p[0] === ':' ? [p[1], p[2]] : [p[1]]

/**
 * A step's operand is an `exp` even when it is an `index`, since every
 * `Index` — a string, a number, or `['Number', exp]` — is one.
 * @type {(l: Lambda) => Exp}
 */
const lambdaChild = ([, operand]) => operand

/**
 * Every node whose operands are all `exp`s, which is every node except the
 * containers and the two walkers. `Index` is an `Exp`, so the tag is the
 * only element skipped.
 * @type {(e: readonly[string, ...readonly Exp[]]) => readonly Exp[]}
 */
const tailChildren = ([, ...rest]) => rest

/** @type {(e: Exp) => readonly Exp[]} */
const children = e => {
    if (!(e instanceof Array)) { return [] }
    switch (e[0]) {
        case '[]': return e[1].flatMap(itemChildren)
        case '{}': return e[1].flatMap(propertyChildren)
        case ',': return e[1]
        case '_': return [e[1], ...e[2].map(lambdaChild)]
        case '_()': return [e[1], ...e[2].map(lambdaChild), e[3]]
        default: return tailChildren(e)
    }
}

/** @type {(e: Exp) => readonly ChainError[]} */
const nodeErrors = e => {
    if (!(e instanceof Array)) { return [] }
    switch (e[0]) {
        case '_': return walker(e, e[2], 2, false)
        case '_()': return walker(e, e[2], 1, true)
        default: return []
    }
}

/** @type {(e: Exp) => readonly ChainError[]} */
const expErrors = e => [...nodeErrors(e), ...children(e).flatMap(expErrors)]

/**
 * Checks every `_`/`_()` node reachable from `e` against the three
 * conditions, and hands `e` back unchanged when they all hold. The first
 * violation found in a depth-first walk is the reported one; a graph with
 * several has several, and this names one at a time.
 *
 * @type {(e: Exp) => Result<Exp, ChainError>}
 */
export const canonical = e => {
    const [first] = expErrors(e)
    return first === undefined ? ok(e) : error(first)
}
