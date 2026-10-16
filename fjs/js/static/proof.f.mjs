import { assertEq } from '../../asserts/module.f.mjs'
import { isNative, isStatic, natives, statics } from './module.f.js'

export const proof = {
    // `Object.is`, `Object.entries` and the four `Number` predicates are the
    // admitted paths, and a path is admitted key for key: a shorter, a
    // longer, another member, another global, a member of the other
    // namespace, the global called as a function and the converting global
    // `isNaN` are not.
    isStatic: () => {
        assertEq(statics.length, 6)
        for (const path of [['Object', 'is'], ['Object', 'entries'], ['Number', 'isInteger'], ['Number', 'isSafeInteger'], ['Number', 'isNaN'], ['Number', 'isFinite']]) {
            assertEq(isStatic(path), true)
        }
        for (const path of [['Object'], ['Object', 'is', 'x'], ['Object', 'keys'], ['Number', 'is'], ['Number', 'entries'], ['Object', 'isInteger'], ['Number', 'MAX_SAFE_INTEGER'], ['Object', ''], ['isNaN'], []]) {
            assertEq(isStatic(path), false)
        }
    },
    // `Object.entries` alone is native, admitted and bodiless; every other
    // admitted path has a body, and a path no list holds is native nowhere.
    isNative: () => {
        assertEq(natives.length, 1)
        assertEq(isNative(['Object', 'entries']), true)
        for (const path of [['Object', 'is'], ['Number', 'isInteger'], ['Object'], ['Object', 'entries', 'x'], ['Number', 'entries'], ['Object', 'keys'], []]) {
            assertEq(isNative(path), false)
        }
        for (const path of natives) {
            assertEq(isStatic(path), true)
        }
    },
}
