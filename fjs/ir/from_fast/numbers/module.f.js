/**
 * The number paths of [the lowering](../module.f.js): a numeric operator
 * of L1 whose operands may hold numbers tests them once and answers with
 * the operator of the IR where they are numbers
 * ([benchmark.md](../../../../doc/sasha-gil/ir/benchmark.md#levers)), and
 * the parts of numbers and primitives that the lowering builds them from:
 * which operands an operator of the IR takes, the boxing of a value as
 * `any`, a primitive as a term, and L1's native rows of numbers.
 *
 * @module
 *
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Primitive } from '../../../media/datajs/types.ts'
 * @import { Module, Param, Scope, Term, Type } from '../../types.ts'
 */

import { assertNotNullish } from '../../../asserts/module.f.js'
import { entry } from '../../../types/object/entry/module.f.js'
import { error, ok, okList, unwrap } from '../../../types/result/module.f.js'
import { typeOf } from '../../check/module.f.js'
import { any, kinds, string } from '../../l0/module.f.js'
import { bool, call, constant, equal, f64, f64c, false_, fits, get, int, let_, lit, match, n, only, terms, true_ } from '../../module.f.js'
import { show } from '../../print/module.f.js'

/** What the number paths read of the lowering's scope: the IR's scope and the depth that names the next local `#k`. @typedef {{ readonly ir: Scope, readonly depth: number }} Depth */

/** Whether a type is a float. @type {(t: Type) => boolean} */
export const isFloat = t => t[0] === 'f64' || t[0] === 'f64c'

/** Whether a type is `any`, of every kind or of some. @type {(t: Type) => boolean} */
export const isAny = t => t[0] === 'sealed' && t[1] === any[1] && t[2] === any[2]

/**
 * The depth after every local `#k` that a term binds: a term lowered at
 * a depth binds `#k` from it on, so a local bound around the term takes a
 * depth after them, or it would be one of them.
 *
 * @type {(t: Term) => number}
 */
export const depthAfter = t => {
    const own = t[0] === 'let' ? [t[1]]
        : t[0] === 'loop' ? t[2].map(([k]) => k)
        : t[0] === 'match' ? t[2].flatMap(([, binder]) => binder === null ? [] : [binder])
        : []
    const here = own.flatMap(k => k.startsWith('#') && k.length > 1 && [...k.slice(1)].every(c => c >= '0' && c <= '9') ? [Number(k.slice(1)) + 1] : [])
    return [...here, ...terms(t).map(depthAfter)].reduce((a, b) => a < b ? b : a, 0)
}

/** L1's numeric operators, which the IR's operators answer where every operand is a number. @type {readonly string[]} */
export const numberOps = ['add', 'subtract', 'multiply', 'divide', 'negate', 'lessThan', 'lessThanOrEqual', 'greaterThan', 'greaterThanOrEqual']

/**
 * A numeric operator of L1 with a path for numbers before its call
 * ([benchmark.md, lever "test only the side that is not known"](../../../../doc/sasha-gil/ir/benchmark.md#levers)):
 * where each operand is a float or a value of `any` that may hold a number,
 * and one is such an `any`, each `any` is matched once against `number`,
 * read once with `to_f64`, and the operator of the IR, `native`, answers
 * where all are numbers, boxed where it is a float. Else `slow`, L1's call
 * of the operands, each float boxed only there. A number is its own
 * primitive and its own numeric value, so L1 would answer the same. Each
 * operand is bound first, in its order, as it is read twice. `null` where
 * an operand may hold no number, for L1's call alone.
 *
 * `pure` binds a term that does something to a local, in the lowering's scope.
 */
export const numberPath =
    /**
     * @template {Depth} S
     * @param {(scope: S, x: Term, rest: (scope: S, y: Term) => Result<Term, string>) => Result<Term, string>} pure
     * @param {S} scope
     * @param {readonly Term[]} xs
     * @param {readonly Type[]} ts
     * @param {(xs: readonly Term[], ts: readonly Type[]) => Result<Term, string> | null} native
     * @param {(ys: readonly Term[]) => Term} slow
     * @returns {Result<Term, string> | null}
     */
    (pure, scope, xs, ts, native, slow) => {
        /** Whether an operand is matched against `number`: `false` for a float, `null` where it holds no number, or nothing else. @type {(t: Type) => boolean | null} */
        const tested = t => {
            if (isFloat(t)) { return false }
            const held = t[0] === 'sealed' ? t[3] ?? kinds : []
            return isAny(t) && held.includes('number') && held.length > 1 ? true : null
        }
        const tests = ts.map(tested)
        if (tests.includes(null) || !tests.includes(true)) { return null }
        /** A scope with one more local of a type, and the local's name. @type {(s: S, t: Type) => readonly [S, string]} */
        const local = (s, t) => {
            const name = `#${s.depth}`
            return [{ ...s, ir: { ...s.ir, locals: [...s.ir.locals, /** @type {Param} */ ([name, t])] }, depth: s.depth + 1 }, name]
        }
        /** The match of each `any` from the `j`th on, its number bound, and the operator of the IR of them all. @type {(s: S, ys: readonly Term[], j: number, numbers: readonly Term[]) => Term} */
        const matched = (s, ys, j, numbers) => {
            if (j === ys.length) {
                // the operands are numbers, which the operator of the IR takes
                const r = unwrap(assertNotNullish(native(numbers, numbers.map(() => f64))))
                return isFloat(unwrap(typeOf(s.ir)(r))) ? call('Any', 'from_f64', [r]) : r
            }
            const y = ys[Number(j)]
            if (!tests[Number(j)]) { return matched(s, ys, j + 1, [...numbers, y]) }
            const [s1, binder] = local(s, only(any, 'number'))
            const [s2, n] = local(s1, f64c)
            return match(y, [[['number'], binder, let_(n, call('Any', 'to_f64', [get(binder)]), matched(s2, ys, j + 1, [...numbers, get(n)]))], [null, null, slow(ys)]])
        }
        /** The operands from the `j`th on bound, in their order, then matched. @type {(s: S, j: number, ys: readonly Term[]) => Result<Term, string>} */
        const bound = (s, j, ys) => j === xs.length ? ok(matched(s, ys, 0, []))
            : pure(s, xs[Number(j)], (inner, y) => bound(inner, j + 1, [...ys, y]))
        // the operands were lowered at this depth, so what they bind is after it
        const depth = [scope.depth, ...xs.map(depthAfter)].reduce((a, b) => a < b ? b : a)
        return bound({ ...scope, depth }, 0, [])
    }

/**
 * A value of `any`, or a float or boolean boxed as one by `from_f64` or
 * `from_bool` ([definition.md's rule 6](../../../../doc/sasha-gil/ir/definition.md#from-normalized-fast-to-the-ir)),
 * or a bigint literal, a literal or a constant of an integer type of one
 * value, made by L1's native row `stringToBigInt` of its decimal text, or
 * `null` where no conversion of this slice fits.
 *
 * @type {(t: Type, x: Term) => Term | null}
 */
export const asAny = (t, x) => isAny(t) ? x
    : isFloat(t) ? call('Any', 'from_f64', [x])
    : equal(t, bool) ? call('Any', 'from_bool', [x])
    : t[0] === 'int' && t[1] === t[2] && (x[0] === 'lit' || x[0] === 'constant') ? call('Native', 'stringToBigInt', [lit(string, String(t[1]))])
    : null

/**
 * A primitive as a term: a number is a float literal, a bigint the range
 * that holds it alone, a boolean a `bool`, a string a literal of `any` that
 * String makes, and `undefined` and `null` are Any's constants. A module
 * lowered without the runtime imports neither. A bigint that no word holds
 * is a value of `any` that L1's native row `stringToBigInt` makes of its
 * decimal text, where the module imports the rows.
 *
 * @type {(imports: Module['imports'], v: Primitive) => Result<Term, string>}
 */
export const primitive = (imports, v) => {
    if (typeof v === 'number') { return ok(lit(f64c, v)) }
    if (typeof v === 'bigint') {
        return fits(64)(int(v, v)) || !imports.some(([k]) => k === 'Native') ? ok(n(v))
            : ok(call('Native', 'stringToBigInt', [lit(string, String(v))]))
    }
    if (typeof v === 'boolean') { return ok(v ? true_ : false_) }
    if (typeof v === 'string') {
        return imports.some(([k]) => k === 'String') ? ok(lit(string, v))
            : error('a string is a literal that String makes, which a module lowered without the runtime does not import')
    }
    const name = v === null ? 'null' : 'undefined'
    return imports.some(([k]) => k === 'Any') ? ok(constant('Any', name))
        : error(`${name} is a constant of Any, which a module lowered without the runtime does not import`)
}

/** Whether the operator of the IR takes operands of these types: floats, or integers. @type {(ts: readonly Type[]) => boolean} */
export const numeric = ts => ts.every(isFloat) || ts.every(t => t[0] === 'int')

/** Whether `!` of the IR takes an operand of these types: a boolean. @type {(ts: readonly Type[]) => boolean} */
export const boolean = ts => ts.every(t => equal(t, bool))

/** Whether operands are floats, which a native row of numbers takes. @type {(ts: readonly Type[]) => boolean} */
export const floats = ts => ts.every(isFloat)

/** A call of L1's native row of numbers `name`, of floats lowered in their order. @type {(name: string) => (xs: readonly Term[]) => Result<Term, string>} */
export const nativeRow = name => xs => ok(call('Native', name, xs))

/** The operator of the IR of two operands, lowered in their order. @type {(f: (a: Term, b: Term) => Term) => (xs: readonly Term[]) => Result<Term, string>} */
export const inOrder = f => xs => ok(f(xs[0], xs[1]))

/**
 * `a % b`, `a >> b` or `a & b` of two floats, `op`: L1's native row of
 * numbers `row`, `numberRemainder`, `numberShiftRight` or `numberAnd`,
 * since WASM has no instruction for `%`, nor for the conversion to a
 * 32-bit integer that the other two read, which a module lowered over the
 * runtime imports.
 *
 * @type {(op: string, row: string) => (scope: { readonly ir: Scope }, xs: readonly Term[]) => Result<Term, string>}
 */
export const numberRow = (op, row) => (scope, xs) => {
    const ts = okList(xs.map(x => typeOf(scope.ir)(x)))
    if (ts[0] === 'error') { return ts }
    const name = assertNotNullish(entry(scope.ir, 'name'))
    return !ts[1].every(isFloat) ? error(`${name}: ${op} of ${ts[1].map(show).join(' and ')} is not in this slice`)
        : !scope.ir.imports.some(([k]) => k === 'Native') ? error(`${name}: ${op} of two floats calls L1's native rows, which a module lowered without the runtime does not import`)
        : ok(call('Native', row, xs))
}
