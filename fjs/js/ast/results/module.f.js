/**
 * Forward an already joined normal result through its enclosing statement.
 * Branch scopes and abrupt exits retain their original identities.
 *
 * @module
 * @import { Statement } from '../types.ts'
 */

/** Remove only a sole conditional result's exact forwarding wrapper. @type {(statement: Statement) => Statement} */
export const _forwardResult = statement => {
    if (statement[0] !== 'block' || statement[1].length !== 1) { return statement }
    const block = statement[2]
    const branch = block.statements[0]
    if (block.statements.length !== 1 || branch[0] !== 'if' || branch[1].length !== 1) { return statement }
    const exit = block.exit
    if (exit[0] !== 'yield' || exit[1].length !== 1) { return statement }
    const value = exit[1][0]
    if (!(value instanceof Array) || value[0] !== 'ref' || value[1] !== branch[1][0]) { return statement }
    return ['if', statement[1], branch[2], branch[3], branch[4]]
}
