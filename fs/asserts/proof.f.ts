import { assert, assertEq, todo } from './module.f.ts'

export const proof = {
    assertPassesOnTrue: () => {
        assert(true)
        assert(true, 'with message')
    },
    assertEqPassesOnEqual: () => {
        assertEq(1, 1)
        assertEq('x', 'x')
    },
    throw: {
        assertEqThrowsOnUnequal: () => assertEq(1, 2),
        assertEqThrowsOnUnequal3: () => assertEq(1, 2, "message"),
        assertThrowsDefaultMsg: () => assert(false),
        assertThrowsCustomMsg: () => assert(false, 'oops'),
        todoThrows: () => todo(),
    },
}
