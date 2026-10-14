import { assertEq } from '../../asserts/module.f.mjs'
import { isStatic, statics } from './module.f.js'

export const proof = {
    // `Object.is` and the four `Number` predicates are the admitted paths,
    // and a path is admitted key for key: a shorter, a longer, another
    // member, another global, a member of the other namespace, the global
    // called as a function and the converting global `isNaN` are not.
    isStatic: () => {
        assertEq(statics.length, 5)
        for (const path of [['Object', 'is'], ['Number', 'isInteger'], ['Number', 'isSafeInteger'], ['Number', 'isNaN'], ['Number', 'isFinite']]) {
            assertEq(isStatic(path), true)
        }
        for (const path of [['Object'], ['Object', 'is', 'x'], ['Object', 'keys'], ['Number', 'is'], ['Object', 'isInteger'], ['Number', 'MAX_SAFE_INTEGER'], ['Object', ''], ['isNaN'], []]) {
            assertEq(isStatic(path), false)
        }
    },
}
