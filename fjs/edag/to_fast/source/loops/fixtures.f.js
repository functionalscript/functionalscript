/** Shared canonical invocation fixtures for source fallback boundaries.
 * @import { Function as FastFunction } from '../../../../js/ast/types.ts'
 */

/** An owning value return removes a one-pass wrapper, without a recursive call. @returns {FastFunction} */
export const _valueReturnFunction = () => {
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const input = /** @type {const} */ ({ index: 0 })
    const state = /** @type {const} */ ({ index: 0 })
    const result = /** @type {const} */ ({ index: 0 })
    const unused = /** @type {const} */ ({ index: 0 })
    return { target: owner, parameters: [input], rest: null, self: null, captures: [], body: {
        statements: [['loop', { target, parameters: [state], initial: [['ref', input]], results: [result], body: {
            statements: [
                ['define', unused, ['if', ['===', ['ref', state], 0],
                    { statements: [], exit: ['return', owner, 7] }, { statements: [], exit: ['yield', [['ref', state]]] }], 'required'],
                ['if', [], ['>', ['ref', state], 0], { statements: [], exit: ['break', target, [['ref', state]]] },
                    { statements: [], exit: ['throw', 'negative input'] }],
            ],
            exit: ['yield', []],
        } }]],
        exit: ['return', owner, ['ref', result]],
    } }
}

/** A result-bearing terminal decision reaches the old recursive source fallback. @returns {FastFunction} */
export const _fallbackFunction = () => {
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const input = /** @type {const} */ ({ index: 0 })
    const state = /** @type {const} */ ({ index: 0 })
    const output = /** @type {const} */ ({ index: 0 })
    const unused = /** @type {const} */ ({ index: 0 })
    const joined = /** @type {const} */ ({ index: 0 })
    return { target: owner, parameters: [input], rest: null, self: null, captures: [], body: {
        statements: [['loop', { target, parameters: [state], initial: [['ref', input]], results: [output], body: {
            statements: [
                ['define', unused, ['if', ['<', ['ref', state], 0],
                    { statements: [], exit: ['return', owner, -7] }, { statements: [], exit: ['yield', [0]] }], 'required'],
                ['if', [joined], ['>', ['ref', state], 0],
                    { statements: [], exit: ['continue', target, [['-', ['ref', state], 1]]] },
                    { statements: [], exit: ['break', target, [7]] }],
            ], exit: ['yield', []],
        } }]], exit: ['return', owner, ['ref', output]],
    } }
}
