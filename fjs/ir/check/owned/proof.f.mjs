/**
 * Proofs of the owned-stage check: hand-written IR that consumes each owned
 * value once, and one refusal per rule.
 */

import { assertEq, assertError, assertOk } from '../../../asserts/module.f.js'
import { any, l0 } from '../../l0/module.f.js'
import {
    bool, call, fn, get, if_, let_, make, only, own, u, unit,
} from '../../module.f.js'
import { check } from '../module.f.js'

const string = only(any, 'string')

/** @type {(params: import('../../types.ts').Param[], result: import('../../types.ts').Type, body: import('../../types.ts').Term) => import('../../types.ts').Module} */
const overL0 = (params, result, body) => ({
    imports: l0,
    functions: [['f', fn(params, result, body)]],
    exports: ['f'],
})

/** @type {(m: import('../../types.ts').Module) => string} */
const why = m => assertError(check(m))

export const proof = {
    // concat of a borrowed string with itself: both arguments borrow, the result is owned.
    concat: () => {
        const m = overL0([['s', string]], string, call('String', 'concat', [get('s'), get('s')]))
        assertEq(assertOk(check(m)).functions[0][0], 'f')
    },
    // from_unit answers an owned string that drop consumes; nothing is left over.
    fromUnitDrop: () => {
        const m = overL0([['c', u(16)]], unit, let_('s', call('String', 'from_unit', [get('c')]), s => call('Any', 'drop', [s])))
        assertOk(check(m))
    },
    // dup of a borrow yields an owned value that may be dropped.
    dupDrop: () => {
        const m = overL0([['s', string]], unit, let_('t', call('Any', 'dup', [get('s')]), t => call('Any', 'drop', [t])))
        assertOk(check(m))
    },
    // one refusal per rule
    refuse: {
        borrowedDrop: () => assertEq(
            why(overL0([['s', string]], unit, call('Any', 'drop', [get('s')]))),
            "f: Any.drop's v: s is borrowed",
        ),
        afterConsume: () => assertEq(
            why(overL0([['c', u(16)]], unit, let_('s', call('String', 'from_unit', [get('c')]), s =>
                let_('_', call('Any', 'drop', [s]), () => call('Any', 'drop', [s]))))),
            "f: Any.drop's v: s is used after it was consumed",
        ),
        leftOver: () => assertEq(
            why(overL0(
                [['c', u(16)], ['b', bool]],
                unit,
                let_('s', call('String', 'from_unit', [get('c')]), s =>
                    if_(get('b'), call('Any', 'drop', [s]), make([]))),
            )),
            'f: match arms leave different owned values',
        ),
        readAfter: () => assertEq(
            why(overL0([['c', u(16)]], unit, let_('s', call('String', 'from_unit', [get('c')]), s =>
                let_('_', call('Any', 'drop', [s]), () =>
                    let_('n', call('String', 'length', [s]), () => make([])))))),
            'f: s is used after it was consumed',
        ),
        ownParamLeft: () => assertEq(
            why(overL0([own('v', any)], unit, make([]))),
            'f: v is left over',
        ),
    },
    // an own parameter consumed by drop is fine
    ownParam: () => {
        assertOk(check(overL0([own('v', any)], unit, call('Any', 'drop', [get('v')]))))
    },
}
