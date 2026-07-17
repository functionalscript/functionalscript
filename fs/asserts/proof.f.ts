import { assert, assertEq, todo } from './module.f.ts'

const throws = (f: () => unknown, expected: unknown): void => {
    let caught = false
    try { f() } catch (e) {
        caught = true
        assert(e === expected, ['unexpected throw value', e])
    }
    assert(caught, 'expected function to throw but it did not')
}

export const proof = {
    assertPassesOnTrue: () => {
        assert(true)
        assert(true, 'with message')
    },
    assertThrowsDefaultMsg: () => {
        throws(() => assert(false), 'assertion failed')
    },
    assertThrowsCustomMsg: () => {
        throws(() => assert(false, 'oops'), 'oops')
    },
    assertEqPassesOnEqual: () => {
        assertEq(1, 1)
        assertEq('x', 'x')
    },
    assertEqThrowsOnUnequal: () => {
        let caught = false
        try { assertEq(1, 2) } catch (e) {
            caught = true
            const arr = e as readonly [unknown, unknown]
            assert(!(arr[0] !== 1 || arr[1] !== 2), ['wrong throw value', e])
        }
        assert(caught, 'expected assertEq to throw')
    },
    todoThrows: () => {
        throws(() => todo(), 'not implemented')
    },
}
