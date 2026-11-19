/** @import { Exp } from './types.ts' */

import { assert, assertStructurallySame } from '../asserts/module.f.js'
import { conditional } from './testlib.f.js'

export const proof = {
    and: () => assertStructurallySame(conditional('&&', 0, 2), ['?:', 0, 2, 0]),
    or: () => assertStructurallySame(conditional('||', 1, 2), ['?:', 1, 1, 2]),
    nullish: () => assertStructurallySame(conditional('??', null, 2), ['?:', ['?:', ['===', null, null], true, ['===', null, ['undefined']]], 2, null]),
    identity: () => {
        const left = /** @type {const} */ (['[]', []])
        const right = /** @type {const} */ (['[]', []])
        for (const tag of /** @type {const} */ (['&&', '||', '??'])) {
            const value = /** @type {readonly ['?:', Exp, Exp, Exp]} */ (conditional(tag, left, right))
            if (tag === '&&') { assert(value[1] === left && value[2] === right && value[3] === left) }
            else if (tag === '||') { assert(value[1] === left && value[2] === left && value[3] === right) }
            else {
                const predicate = /** @type {readonly ['?:', readonly ['===', Exp, Exp], Exp, readonly ['===', Exp, Exp]]} */ (value[1])
                assert(predicate[1][1] === left && predicate[3][1] === left && value[2] === right && value[3] === left)
            }
        }
    },
}
