/**
 * @import { Nominal, _SymbolKeyBranded, _SymbolIntersectionBranded } from "./types.ts"
 */

import { asBase, asNominal } from "./module.f.mjs"
import { assert } from '../../asserts/module.f.mjs'

export const proof = {
    pre: () => {
        /** @typedef {Nominal<'utf8', 'v0', bigint>} _Str */
        /** @type {_Str} */
        const strA = asNominal(0b1_11000010_10100010_11000010_10100011n) // "¢£"
        /** @type {_Str} */
        const strB = asNominal(0b1_11000010_10100010_11000010_10100100n) // "¢¤"
        assert(strA !== strB, [strA, strB])
        // // TypeScript compilation error.
        // const x1 = strA > strB

        //
        {
            /**
             * @template {object} [T=object]
             * @typedef {T & { __noCompare__: never }} _ForbiddenCompare
             */
            /** @typedef {_ForbiddenCompare<{ value: number }>} _IntersectionSafeId */
            const a = { value: 1 }
            const b = { value: 2 }

            // No Compile-time error
            if (a < b) { }
        }

        {
            /** @typedef {{ _brand: 'NoCompare' }} _StringKeyBranded */
            /** @type {_StringKeyBranded} */
            const x = { _brand: 'NoCompare' }
            // No Error
            if (x < x) { }
        }
        {
            const a = {}
            const b = {}

            // No Error
            a < b
        }
        {

            const a = /** @type {any} */ (undefined)
            const b = /** @type {any} */ (undefined)

            // a < b; // TS2469: Operator '<' cannot be applied to type 'symbol'.
        }
    },
    nominal: () => {
        /** @typedef {Nominal<'UserId', '1', number>} _UserId */
        /** @typedef {Nominal<'UserId', '2', number>} _UserId2 */
        /** @type {_UserId} */
        const userIdA = asNominal(123)
        /** @type {_UserId} */
        const userIdB = asNominal(456)
        assert(userIdA !== userIdB, [userIdA, userIdB])
        /** @type {(_: _UserId) => number} */
        const to = asBase
        /** @type {(_: _UserId2) => number} */
        const to2 = asBase
        /** @type {_UserId2} */
        const userId2A = asNominal(123)
        /** @type {_UserId2} */
        const userId2B = asNominal(456)
        assert(userId2A !== userId2B, [userId2A, userId2B])
        // assert(userIdA !== userId2A, [userIdA, userId2A]) // compilation error
        /** @type {number} */
        const n1 = to(userIdA)
        /** @type {number} */
        const n2 = to2(userId2A)
        // const x = to(userId2A) // compilation error
    }
}
