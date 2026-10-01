import {
    assert,
    assertEq,
    assertError,
    assertErrorPath,
    assertOk,
    assertStructurallySame,
    todo,
} from './module.f.mjs'

export const proof = {
    assertPassesOnTrue: () => {
        assert(true)
        assert(true, 'with message')
    },
    assertEqPassesOnEqual: () => {
        assertEq(1, 1)
        assertEq('x', 'x')
    },
    assertStructurallySamePassesOnSame: () => {
        // the case `assertEq` cannot do: two separately built values
        assertStructurallySame({ a: 1, b: [2, { c: 3 }] }, { b: [2, { c: 3 }], a: 1 })
        assertStructurallySame(1, 1, 'with message')
    },
    assertOkReturnsTheValue: () => {
        assertEq(assertOk(['ok', 1]), 1)
    },
    assertErrorReturnsTheError: () => {
        assertEq(assertError(['error', 'e']), 'e')
    },
    assertErrorPathPassesOnSamePath: () => {
        assertErrorPath(['a', '0'])(['error', { path: ['a', '0'] }])
    },
    throw: {
        assertEqThrowsOnUnequal: () => assertEq(1, 2),
        assertEqThrowsOnUnequal3: () => assertEq(1, 2, "message"),
        assertStructurallySameThrowsOnDifferent:
            () => assertStructurallySame({ a: 1 }, { a: 2 }),
        assertStructurallySameThrowsOnDifferent3:
            () => assertStructurallySame({ a: 1 }, { a: 2 }, 'message'),
        assertThrowsDefaultMsg: () => assert(false),
        assertThrowsCustomMsg: () => assert(false, 'oops'),
        assertOkThrowsOnError: () => assertOk(['error', 'e']),
        assertErrorThrowsOnOk: () => assertError(['ok', 1]),
        assertErrorPathThrowsOnOk: () => assertErrorPath([])(['ok', 1]),
        assertErrorPathThrowsOnDifferentPath:
            () => assertErrorPath(['a'])(['error', { path: ['b'] }]),
        todoThrows: () => todo(),
    },
}
