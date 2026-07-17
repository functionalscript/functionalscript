import { assert, assertEq, todo } from './module.f.ts'

// This validates `assert` itself, so it must not rely on `assert` to report
// a failure — an `assert` regressed to a no-op would otherwise make this
// self-test pass silently instead of catching the regression.
const throws = (f: () => unknown, expected: unknown): void => {
    let caught = false
    try { f() } catch (e) {
        caught = true
        if (e !== expected) { throw ['unexpected throw value', e] }
    }
    if (!caught) { throw 'expected function to throw but it did not' }
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
        // Same self-test independence concern as `throws` above: `assertEq`
        // throws via `assert`, so this check can't rely on `assert` either.
        let caught = false
        try { assertEq(1, 2) } catch (e) {
            caught = true
            const arr = e as readonly [unknown, unknown]
            if (arr[0] !== 1 || arr[1] !== 2) { throw ['wrong throw value', e] }
        }
        if (!caught) { throw 'expected assertEq to throw' }
    },
    todoThrows: () => {
        throws(() => todo(), 'not implemented')
    },
}
