/**
 * What the proofs of the lowering share: the normalized FAST of a module's
 * text, as the compiler makes it, and the signatures of
 * [`sample.f.js`](./sample.f.js), which FAST does not have.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { Block } from '../../js/ast/types.ts'
 * @import { Signature } from '../types.ts'
 */

import { error } from '../../types/result/module.f.js'
import { tryUnresolved } from '../../compiler/edag/module.f.mjs'
import { parse } from '../../compiler/transpiler/module.f.mjs'
import { toFast } from '../../edag/to_fast/module.f.mjs'
import { bool, f64, i, int, signature, u } from '../module.f.mjs'

/**
 * The normalized FAST of a module's text: parsed, lowered to the EDAG and
 * converted back, which is what [`definition.fast.mjs`](../../../doc/sasha-gil/ir/definition.fast.mjs)
 * prints. A module that imports is refused here, where its imports are
 * still a list, since FAST reads each as a binding that nothing defines.
 *
 * @type {(text: string) => Result<Block, string>}
 */
export const fastOf = text => {
    const ast = parse('')(text)
    if (ast[0] === 'error') { return error(`parse: ${ast[1].message}`) }
    const unresolved = tryUnresolved(ast[1])
    return unresolved[0] === 'error' ? unresolved
        : unresolved[1].imports.length !== 0 ? error('an import is not in this slice')
        : toFast(unresolved[1].edag)
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
