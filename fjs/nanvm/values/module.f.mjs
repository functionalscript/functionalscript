/**
 * A memo-interpreted capture graph for the native Rust harness. The input
 * computes its captures before the existing Rust emitter sees the result;
 * source-normalized frames cannot express its primitive, repeated and unused
 * capture slots. A factory also constructs nested captures at invocation time.
 * `npm run gen` writes the module through `../update`.
 *
 * @module
 * @import { Exp, Function as EdagFunction } from '../../edag/types.ts'
 * @import { EdagValue } from '../../edag/value/types.ts'
 */

import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { generate as generateRust } from '../../compiler/rust/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'

/** The native harness's interpreted-value fixtures. */
export const directory = 'nanvm-harness/gen.values'

/** The Rust module consumed by the native capture proof. */
export const path = `${directory}/captures.rs`

/**
 * Compute a fresh export graph, retaining captures and repeated references.
 * The sibling callables share evaluated slots; their fourth slot is unused.
 * The factory captures the shared array and makes a fresh local array for
 * each returned function, which either returns or throws that local capture.
 * @type {() => EdagValue}
 */
export const value = () => {
    /** @type {Exp} */
    const shared = ['[]', [['+', 1, 2]]]
    /** @type {Exp} */
    const unused = ['{}', [[':', 'unused', ['+', 4, 5]]]]
    /** @type {readonly Exp[]} */
    const slots = [['+', 1, 1], shared, shared, unused]
    /** @type {() => EdagFunction} */
    const make = () => ['=>', 1, slots, ['[]', [
        ['+', ['frame', 0], ['arg', 0]], ['frame', 1], ['frame', 2],
    ]]]
    const call = make()
    /** @type {EdagFunction} */
    const factory = ['=>', 1, [shared], ['=>', 1, [
        ['frame', 0], ['[]', [['arg', 0]]],
    ], ['?:', ['arg', 0],
        ['[]', [['frame', 0], ['frame', 1], ['frame', 1]]],
        ['throw', ['frame', 1]],
    ]]]
    /** @type {Exp} */
    const expression = ['{}', [
        [':', 'shared', shared], [':', 'alias', shared],
        [':', 'call', call], [':', 'again', call], [':', 'other', make()],
        [':', 'make', factory],
    ]]
    return unwrap(memo(unwrap(analysis(expression)))({ args: [] }))
}

/** Emit the interpreted value through the existing Rust backend. @type {() => string} */
export const generate = () => [
    '// Fixture source: `fjs/nanvm/values/module.f.mjs`; regenerate with `npm run gen`.',
    generateRust(value()),
].join('\n')
