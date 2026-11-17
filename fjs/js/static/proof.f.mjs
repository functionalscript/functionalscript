import { assertEq } from '../../asserts/module.f.js'
import { isNative, isStatic, natives, statics } from './module.f.js'

export const proof = {
    // The Object statics, String.fromCharCode, Number predicates and the
    // admitted Math functions are paths judged key for key: a shorter, a
    // longer, another member, another global, a member of the other
    // namespace, the global called as a function and the converting global
    // `isNaN` are not.
    isStatic: () => {
        assertEq(statics.length, 23)
        assertEq(isStatic(['encodeURIComponent']), true)
        assertEq(isStatic(['encodeURIComponent', '']), false)
        assertEq(isStatic(['encodeURIComponent', 'length']), false)
        assertEq(isStatic(['Number', 'MAX_VALUE']), false)
        for (const path of [['String', 'fromCharCode'], ['Object', 'is'], ['Object', 'entries'], ['Object', 'keys'], ['Object', 'values'], ['Object', 'fromEntries'], ['Number', 'isInteger'], ['Number', 'isSafeInteger'], ['Number', 'isNaN'], ['Number', 'isFinite'], ['Math', 'log2'], ['Math', 'trunc'], ['Math', 'floor'], ['Math', 'abs'], ['Math', 'sqrt'], ['Math', 'ceil'], ['Math', 'imul'], ['Math', 'max'], ['Math', 'min'], ['Math', 'fround'], ['Math', 'clz32'], ['Math', 'round']]) {
            assertEq(isStatic(path), true)
        }
        for (const path of [['Object'], ['Object', 'is', 'x'], ['Object', 'assign'], ['Number', 'is'], ['Number', 'entries'], ['Object', 'isInteger'], ['Number', 'MAX_SAFE_INTEGER'], ['Object', ''], ['Math'], ['Math', 'log'], ['Math', 'cbrt'], ['Math', 'log2', 'x'], ['Math', 'clz32', 'x'], ['Math', 'round', 'x'], ['Math', 'clz'], ['isNaN'], []]) {
            assertEq(isStatic(path), false)
        }
    },
    // `Object.entries`, `String.fromCharCode` and the native Math functions
    // are native, admitted and bodiless; every other
    // admitted path has a body, and a path no list holds is native nowhere.
    isNative: () => {
        assertEq(isNative(['encodeURIComponent']), false)
        assertEq(natives.length, 11)
        assertEq(isNative(['Object', 'entries']), true)
        assertEq(isNative(['String', 'fromCharCode']), true)
        assertEq(isNative(['Math', 'trunc']), true)
        assertEq(isNative(['Math', 'floor']), true)
        assertEq(isNative(['Math', 'abs']), true)
        assertEq(isNative(['Math', 'sqrt']), true)
        assertEq(isNative(['Math', 'ceil']), true)
        assertEq(isNative(['Math', 'imul']), true)
        assertEq(isNative(['Math', 'max']), true)
        assertEq(isNative(['Math', 'min']), true)
        assertEq(isNative(['Math', 'clz32']), true)
        for (const path of [['Object', 'is'], ['Number', 'isInteger'], ['Math', 'log2'], ['Math', 'fround'], ['Math', 'round'], ['Math', 'clz32', 'x'], ['Math', 'trunc', 'x'], ['Math', 'floor', 'x'], ['Math', 'abs', 'x'], ['Math', 'sqrt', 'x'], ['Math', 'ceil', 'x'], ['Math', 'imul', 'x'], ['Math', 'max', 'x'], ['Math', 'min', 'x'], ['Math', 'cbrt'], ['Object'], ['Object', 'entries', 'x'], ['Number', 'entries'], ['Object', 'keys'], ['Object', 'values'], []]) {
            assertEq(isNative(path), false)
        }
        for (const path of natives) {
            assertEq(isStatic(path), true)
        }
    },
}
