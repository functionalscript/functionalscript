import { cmp, tryParse } from './module.f.mjs'
import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

export const proof = {
    tryParse: {
        plain: () => assertStructurallySame(tryParse('0.11.10'), [0, 11, 10]),
        // A prefix such as `process.version`'s `v` is the caller's to remove.
        v: () => assertEq(tryParse('v22.20.0'), null),
        // `Number('bad')` is `NaN`, which compares equal to everything.
        letter: () => assertEq(tryParse('1.bad'), null),
        emptyPart: () => assertEq(tryParse('0..1'), null),
        empty: () => assertEq(tryParse(''), null),
        sign: () => assertEq(tryParse('-1.0'), null),
        // Past `Number.MAX_SAFE_INTEGER` two different parts round to one.
        unsafe: () => assertEq(tryParse('9007199254740993'), null),
        maxSafe: () => assertStructurallySame(tryParse('9007199254740991'), [9007199254740991]),
    },
    cmp: {
        less: () => assertEq(cmp('25.99.99')('26.0.0'), -1),
        greater: () => assertEq(cmp('26.1.0')('26.0.0'), 1),
        equal: () => assertEq(cmp('26.1.1')('26.1.1'), 0),
        // Text ordering would put `0.11.10` first.
        notLexicographic: () => assertEq(cmp('0.11.2')('0.11.10'), -1),
        patch: () => assertEq(cmp('26.1.0')('26.1.1'), -1),
        missingIsZero: () => assertEq(cmp('0.11')('0.11.0'), 0),
        shorterIsSmaller: () => assertEq(cmp('0.11')('0.11.1'), -1),
        longerIsGreater: () => assertEq(cmp('0.11.1')('0.11'), 1),
        throw: {
            first: () => cmp('1.bad')('1.2'),
            second: () => cmp('1.2')('1.bad'),
        },
    },
}
