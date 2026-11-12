/**
 * The L1 bodies against the interpreter: each operator, applied to every
 * pair from a table of values, answers in [`..`](../module.f.js) what the
 * FunctionalScript interpreter answers, running the compiled expression
 * under [`fjs/js/runtime`](../../../../js/runtime/module.f.js), or both
 * throw. The interpreter is the executor whose semantics NaNVM's are
 * checked against, so this checks the bodies against the semantics they
 * copy, where `../proof.f.mjs` checks them against JavaScript's.
 *
 * It is a host proof because it needs what FunctionalScript has not: it
 * builds each host value from its source with `Function`, and it catches
 * what an L1 body throws with `try`/`catch`, so that a throw on both sides
 * counts as agreement.
 */

import { assertEq, assertOk } from '../../../../asserts/module.f.js'
import { _transpileDefault } from '../../../../compiler/transpiler/module.f.mjs'
import { pureOk } from '../../../../effects/module.f.js'
import { vm } from '../../../../edag/amnesia/module.f.mjs'
import { read } from '../../../../edag/value/property/module.f.js'
import { virtualAt } from '../../../../effects/node/virtual/module.f.mjs'
import runtimeEdag from '../../../../js/runtime/gen.edag.js'
import { utf8 } from '../../../../text/module.f.mjs'
import {
    add, divide, get, greaterThan, greaterThanOrEqual, lessThan, lessThanOrEqual, multiply, negate,
    strictEquals, subtract, toBoolean, toNumber, toString, typeOf,
} from '../module.f.js'

const runtime = /** @type {import('../../../../edag/value/types.ts').Runtime} */ (assertOk(read(
    vm({ frame: [], args: [] })(/** @type {import('../../../../edag/types.ts').Exp} */ (/** @type {unknown} */ (runtimeEdag))),
    'runtime')))

/** What the interpreter answers for `export default <source>`. @type {(source: string) => readonly [string, unknown?]} */
const interpreted = source => {
    const [, result] = virtualAt({ 'e.f.js': [utf8(`export default ${source};`)] })(_transpileDefault(pureOk(runtime))('e.f.js'))
    if (result[0] === 'error') {
        return 'thrown' in result[1] ? ['throws'] : ['failed', JSON.stringify(result[1])]
    }
    const [tag, value] = result[1]
    return tag === 'ok' ? ['ok', value] : ['refused', value]
}

/** What an L1 body answers. @type {(f: () => unknown) => readonly [string, unknown?]} */
const l1 = f => {
    try {
        return ['ok', f()]
    } catch {
        return ['throws']
    }
}

/** Values as source, each evaluated by the host for L1 and compiled for the interpreter. */
const sources = [
    'undefined', 'null', 'true', 'false', '0', '-0', '1', '-1.5', '0 / 0', '1 / 0',
    "''", "'a'", "'ab'", "'1'", "'\\u{1F600}'", '0n', '1n', '-2n',
    '[]', '[1]', '[1, 2]', '{}', '{ a: 1 }', '{ valueOf: () => 2 }', '{ toString: () => "x" }',
]

/**
 * {@link sources} and a function. A function's text is the runtime's: the
 * interpreter renders its own, where a JavaScript host answers the source,
 * so a function joins only the operations that do not read its text.
 */
const withFunction = [...sources, 'x => x']

/** The host value of a source. @type {(s: string) => unknown} */
const value = s => Function(`return ${s}`)()

/** Whether two outcomes agree, `NaN` and the zeros told apart. @type {(a: readonly [string, unknown?], b: readonly [string, unknown?]) => boolean} */
const agree = (a, b) => a[0] === b[0] && Object.is(a[1], b[1])

/** @type {readonly (readonly [string, (a: unknown, b: unknown) => unknown])[]} */
const binary = [
    ['+', add], ['-', subtract], ['*', multiply], ['/', divide],
    ['<', lessThan], ['>', greaterThan], ['<=', lessThanOrEqual], ['>=', greaterThanOrEqual],
    ['===', strictEquals],
]

/** @type {readonly (readonly [string, (a: unknown) => unknown])[]} */
const unary = [
    ['typeof (#)', typeOf], ['-(#)', negate], ['!!(#)', toBoolean],
]

/**
 * Unary operations that read a function's text, or that the compiler does
 * not take as an operator: `ToNumber` is written as `Number(...)`, since the
 * compiler has no unary `+` yet.
 *
 * @type {readonly (readonly [string, (a: unknown) => unknown])[]}
 */
const textual = [
    ['Number(#)', toNumber], ['`${#}`', toString],
]

/**
 * Keys a member read takes: numbers and strings, as the compiler emits
 * them. A computed number key is written `Number(...)`, as the compiler
 * requires.
 */
const keySources = ['Number(0)', 'Number(1)', 'Number(-0)', 'Number(1.5)', "'0'", "'01'", "'a'", "'length'"]

/** One proof per pair, so a failure names the expression. @type {(pairs: readonly (readonly [string, () => unknown])[]) => { readonly [k in string]: () => void }} */
const each = pairs => Object.fromEntries(pairs.map(([source, f]) => [source, () => {
    const i = interpreted(source)
    const b = l1(f)
    assertEq(agree(i, b), true, `${source}: interpreter ${String(i)}, l1 ${String(b)}`)
}]))

export const proof = {
    // A function and a number or a function never reads the text, but a
    // string beside it would, so the table leaves functions out.
    binary: each(binary.flatMap(([op, f]) => sources.flatMap(a => sources.map(b =>
        /** @type {const} */ ([`(${a}) ${op} (${b})`, () => f(value(a), value(b))]))))),
    unary: each([
        ...unary.flatMap(([op, f]) => withFunction.map(a => /** @type {const} */ ([op.replace('#', a), () => f(value(a))]))),
        // `Number(b)` of a bigint `b` is its number, where `ToNumber` throws.
        ...textual.flatMap(([op, f]) => sources.filter(a => op === '`${#}`' || !a.endsWith('n'))
            .map(a => /** @type {const} */ ([op.replace('#', a), () => f(value(a))]))),
    ]),
    get: each(withFunction.flatMap(a => keySources.map(k =>
        /** @type {const} */ ([`(${a})[${k}]`, () => get(value(a), value(k))])))),
}
