/**
 * What the proofs of the lowering share: the normalized FAST of a module's
 * text, as the compiler makes it, with its imports, and the signatures of
 * [`sample.f.js`](./sample.f.js), of [`helpers.f.js`](./helpers.f.js) and
 * of the functions of L1 that the lowering reads, which FAST does not have.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { AstImport } from '../../compiler/ast/types.ts'
 * @import { Block } from '../../js/ast/types.ts'
 * @import { Signature } from '../types.ts'
 */

import { error, ok } from '../../types/result/module.f.js'
import { tryUnresolved } from '../../compiler/edag/module.f.mjs'
import { parse } from '../../compiler/transpiler/module.f.mjs'
import { toFast } from '../../edag/to_fast/module.f.mjs'
import { any } from '../l0/module.f.js'
import { bool, f64, i, int, signature, u } from '../module.f.js'

/**
 * The normalized FAST of a module's text and its imports: parsed, lowered
 * to the EDAG and converted back, which is what
 * [`definition.fast.mjs`](../../../doc/sasha-gil/ir/definition.fast.mjs)
 * prints. FAST reads import `i` from the arguments of the module, and
 * `imports[i]` says what it is.
 *
 * @type {(text: string) => Result<{ readonly fast: Block, readonly imports: readonly AstImport[] }, string>}
 */
export const sourceOf = text => {
    const ast = parse('')(text)
    if (ast[0] === 'error') { return error(`parse: ${ast[1].message}`) }
    const unresolved = tryUnresolved(ast[1])
    if (unresolved[0] === 'error') { return unresolved }
    const fast = toFast(unresolved[1].edag)
    return fast[0] === 'error' ? fast : ok({ fast: fast[1], imports: unresolved[1].imports })
}

/** The runtime that L1 is lowered over: the specifiers by which it imports the L0 view and its native rows. */
export const runtime = { l0: '../l0/module.f.js', native: './native/module.f.js' }

const any2 = /** @type {const} */ ([['a', any], ['b', any]])

/**
 * The signatures of the functions of L1 that the slices lower so far: the
 * third slice's `toBoolean`, the fourth's string comparisons, and the
 * fifth's `strictEquals` and `stringIndex`. An index is a number in
 * JavaScript, so a float here.
 *
 * @type {Readonly<Record<string, Signature>>}
 */
export const l1 = {
    toBoolean: signature([['v', any]], bool),
    stringEquals: signature(any2, bool),
    stringLess: signature(any2, bool),
    strictEquals: signature(any2, bool),
    stringIndex: signature([['s', any]], f64),
}

const f2 = /** @type {const} */ ([['a', f64], ['b', f64]])
const b2 = /** @type {const} */ ([['a', bool], ['b', bool]])

/** The signatures of `sample.f.js`, each `bigint` with its range. @type {Readonly<Record<string, Signature>>} */
export const signatures = {
    max: signature(f2, f64),
    negate: signature([['x', f64]], f64),
    magnitude: signature([['x', f64]], f64),
    hypot: signature(f2, f64),
    distance: signature([['x', f64], ['y', f64], ['p', f64], ['q', f64]], f64),
    safeDiv: signature(f2, f64),
    pow: signature([['x', f64], ['k', f64]], f64),
    square: signature(f2, f64),
    early: signature(f2, f64),
    greater: signature(f2, bool),
    atLeast: signature(f2, bool),
    sum: signature([['a', u(32)], ['b', u(32)]], u(33)),
    delta: signature([['a', u(16)], ['b', u(16)]], i(17)),
    product: signature([['a', u(32)], ['b', u(32)]], u(64)),
    opposite: signature([['x', i(32)]], int(-(1n << 31n) + 1n, 1n << 31n)),
    sign: signature([['x', i(32)]], int(-1n, 1n)),
    clamp: signature([['x', i(32)], ['lo', i(32)], ['hi', i(32)]], i(32)),
    same: signature([['a', i(32)], ['b', u(32)]], bool),
    notEqual: signature([['a', i(64)], ['b', i(64)]], bool),
    lessU64: signature([['a', u(64)], ['b', u(64)]], bool),
    average: signature([['a', u(32)], ['b', u(32)]], f64),
    xor: signature(b2, bool),
    both: signature(b2, bool),
    either: signature(b2, bool),
    sameBool: signature(b2, bool),
    differ: signature(b2, bool),
}

/** The signatures of `helpers.f.js`, which the lowering reads over the runtime. @type {Readonly<Record<string, Signature>>} */
export const helpers = {
    index: signature([['n', f64]], f64),
    remainder: signature(f2, f64),
    mod3: signature([['a', f64]], f64),
    sumOfTwice: signature(f2, f64),
    doubleBoth: signature([['a', u(8)], ['b', u(16)]], i(18)),
    quadruple: signature([['x', f64]], f64),
    meanOfSquare: signature(f2, f64),
    middle: signature([['a', f64], ['b', f64], ['c', f64], ['d', f64]], f64),
    gcd: signature(f2, f64),
    steps: signature([['a', f64]], f64),
}
