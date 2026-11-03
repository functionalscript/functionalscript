/**
 * Lexical region payloads and statement sequences after binding resolution.
 * @module
 * @import { SourceBlock, SourceStatement, SourceValue } from '../../../js/ast/sugar/source.ts'
 */

import { assert } from '../../../asserts/module.f.js'

/** Binding identities and lexical events already preserve the erased scope. @type {(body: SourceBlock) => readonly SourceStatement[]} */
export const _flattenedStandalone = body => {
    assert(body.exit[0] === 'yield' || body.exit[0] === 'throw')
    return body.exit[0] === 'throw' ? [...body.statements, ['throw', body.exit[1]]] : body.statements
}

/** A resolved lexical region payload, including normal and terminal branches. @type {(value: SourceValue) => SourceBlock} */
export const _regionBlock = value => {
    assert(value instanceof Array && value[0] === 'block')
    return value[1]
}

/** Explicit throw stays refused in lexical arms; ordinary functions own theirs. @type {(arms: readonly SourceBlock[]) => boolean} */
export const _hasArmThrow = arms => {
    let pending = arms
    while (pending.length !== 0) {
        const block = pending[0]
        if (block.exit[0] === 'throw') { return true }
        pending = pending.slice(1)
        if (block.exit[0] === 'terminal-loop') { pending = [...pending, block.exit[1].body] }
        for (const statement of block.statements) {
            if (statement[0] === 'throw') { return true }
            if (statement[0] === 'if') { pending = [...pending, statement[2], statement[3]] }
            if (statement[0] === 'while' || statement[0] === 'for-of') { pending = [...pending, statement[1].body] }
            if (statement[0] === 'switch') { pending = [...pending, ...statement[1].cases.map(arm => arm.body), statement[1].otherwise] }
        }
    }
    return false
}
