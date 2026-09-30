import { cmp, parse } from './module.f.mjs'
import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

export const proof = {
    parse: {
        plain: () => assertStructurallySame(parse('0.11.10'), [0, 11, 10]),
        // `process.version` prints a leading `v`.
        v: () => assertStructurallySame(parse('v22.20.0'), [22, 20, 0]),
    },
    cmp: {
        less: () => assertEq(cmp('25.99.99')('26.0.0'), -1),
        greater: () => assertEq(cmp('26.1.0')('26.0.0'), 1),
        equal: () => assertEq(cmp('26.1.1')('26.1.1'), 0),
        // Text ordering would put `0.11.10` first.
        notLexicographic: () => assertEq(cmp('0.11.2')('0.11.10'), -1),
        patch: () => assertEq(cmp('26.1.0')('26.1.1'), -1),
        v: () => assertEq(cmp('v22.20.0')('26.0.0'), -1),
        missingIsZero: () => assertEq(cmp('0.11')('0.11.0'), 0),
        shorterIsSmaller: () => assertEq(cmp('0.11')('0.11.1'), -1),
        longerIsGreater: () => assertEq(cmp('0.11.1')('0.11'), 1),
    },
}
