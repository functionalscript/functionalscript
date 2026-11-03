/**
 * Expand a written const group into ordered declarations for source lowering.
 * @import { Const } from '../syntax/types.ts'
 */

/** @type {(statement: Const) => readonly Const[]} */
export const declarations = statement => {
    const { following, start, target, value } = statement
    if (following === undefined || following.length === 0) { return [statement] }
    return [{ start, target, value, semicolon: true }, ...following.map((declaration, index) => ({
        ...declaration, semicolon: index < following.length - 1 || statement.semicolon,
    }))]
}
