import { assertEq } from '../../asserts/module.f.mjs'
import { isStatic, statics } from './module.f.js'

export const proof = {
    // `Object.is` is the one admitted path, and a path is admitted key for
    // key: a shorter, a longer, another member, another global and the
    // global called as a function are not.
    isStatic: () => {
        assertEq(statics.length, 1)
        assertEq(isStatic(['Object', 'is']), true)
        for (const path of [['Object'], ['Object', 'is', 'x'], ['Object', 'keys'], ['Number', 'is'], ['Object', ''], []]) {
            assertEq(isStatic(path), false)
        }
    },
}
