import { assertEq } from '../../asserts/module.f.js'
import { isNative, isStatic, natives, statics } from './module.f.js'

export const proof = {
    // The Object statics, String.fromCharCode, Number predicates, Math.log2 and Math.trunc are the
    // admitted paths, and a path is admitted key for key: a shorter, a
    // longer, another member, another global, a member of the other
    // namespace, the global called as a function and the converting global
    // `isNaN` are not.
    isStatic: () => {
        assertEq(statics.length, 11)
        for (const path of [['String', 'fromCharCode'], ['Object', 'is'], ['Object', 'entries'], ['Object', 'keys'], ['Object', 'fromEntries'], ['Number', 'isInteger'], ['Number', 'isSafeInteger'], ['Number', 'isNaN'], ['Number', 'isFinite'], ['Math', 'log2'], ['Math', 'trunc']]) {
            assertEq(isStatic(path), true)
        }
        for (const path of [['Object'], ['Object', 'is', 'x'], ['Object', 'values'], ['Number', 'is'], ['Number', 'entries'], ['Object', 'isInteger'], ['Number', 'MAX_SAFE_INTEGER'], ['Object', ''], ['Math'], ['Math', 'log'], ['Math', 'log2', 'x'], ['isNaN'], []]) {
            assertEq(isStatic(path), false)
        }
    },
    // `Object.entries`, `String.fromCharCode` and `Math.trunc` are native, admitted and bodiless; every other
    // admitted path has a body, and a path no list holds is native nowhere.
    isNative: () => {
        assertEq(natives.length, 3)
        assertEq(isNative(['Object', 'entries']), true)
        assertEq(isNative(['String', 'fromCharCode']), true)
        assertEq(isNative(['Math', 'trunc']), true)
        for (const path of [['Object', 'is'], ['Number', 'isInteger'], ['Math', 'log2'], ['Math', 'trunc', 'x'], ['Object'], ['Object', 'entries', 'x'], ['Number', 'entries'], ['Object', 'keys'], []]) {
            assertEq(isNative(path), false)
        }
        for (const path of natives) {
            assertEq(isStatic(path), true)
        }
    },
}
