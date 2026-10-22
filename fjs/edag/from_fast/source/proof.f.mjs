/** Source/native labels construct canonical graphs without copying operands. */

import { assert, assertStructurallySame } from '../../../asserts/module.f.js'
import { conditional } from '../../testlib.f.js'
import { logicalExp } from './module.f.mjs'

export const proof = {
    operators: () => {
        for (const tag of /** @type {const} */ (['&&', '||', '??'])) {
            const left = /** @type {const} */ (['[]', []])
            const right = /** @type {const} */ (['{}', []])
            const value = logicalExp(tag, left, right)
            assertStructurallySame(value, conditional(tag, left, right))
            assert(value instanceof Array && value[0] === '?:')
            assert(value[2] === (tag === '||' ? left : right))
            assert(value[3] === (tag === '||' ? right : left))
            if (tag !== '??') {
                assert(value[1] === left)
            } else {
                const condition = value[1]
                assert(condition instanceof Array && condition[0] === '?:')
                const nullTest = condition[1]
                const undefinedTest = condition[3]
                assert(nullTest instanceof Array && nullTest[0] === '===' && nullTest[1] === left)
                assert(undefinedTest instanceof Array && undefinedTest[0] === '===' && undefinedTest[1] === left)
            }
        }
    },
    establishedOperands: () => {
        const left = /** @type {const} */ (['arg', 0])
        const right = /** @type {const} */ (['frame', 0])
        const value = logicalExp('&&', left, right)
        assert(value instanceof Array && value[0] === '?:' && value[1] === left && value[2] === right && value[3] === left)
    },
}
