/**
 * Source operator conveniences for canonical graph producers. Their semantic
 * lowering belongs to source FAST sugar; graph values enter as external refs.
 *
 * @module
 * @import { Exp } from '../../types.ts'
 * @import { LogicalTag } from '../../../js/ast/sugar/source.ts'
 */

import { logicalValue } from '../../../js/ast/sugar/logical/module.f.mjs'
import { fromFast } from '../module.f.mjs'

/** Source logical selection as canonical conditionals, retaining operand identities. @type {(tag: LogicalTag, left: Exp, right: Exp) => Exp} */
export const logicalExp = (tag, left, right) => {
    const lhs = { index: 0 }
    const rhs = { index: 1 }
    return fromFast({ statements: [], exit: ['yield', [logicalValue(tag, ['ref', lhs], ['ref', rhs])]] }, [[lhs, left], [rhs, right]])
}
