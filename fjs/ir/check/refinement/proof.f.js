/**
 * Proofs of the H2b comparison-refinement model: lattice inclusion, join
 * and meet, the transfer table against
 * [comparison-refinement.md](../../../../doc/sasha-gil/ir/comparison-refinement.md),
 * soundness of concrete pairs into the projected ranges, and that the
 * checker's `learned` path (joins / loops) stays conservative.
 */

import { assert, assertEq, assertError, assertOk } from '../../../asserts/module.f.js'
import {
    add, block, br, eq, fn, get, i, if_, int, le, let_, loop, lt, match, n, ne, next, not, u,
} from '../../module.f.js'
import { show } from '../../print/module.f.js'
import { narrowing } from '../../testlib.f.js'
import { check } from '../module.f.js'
import { compared, join, meet, range, same, sub } from './module.f.js'

/** @type {(m: import('../../types.ts').Module) => string} */
const bodyType = m => show(assertOk(check(m)).functions[0][1].body[0])

/** @type {(params: readonly import('../../types.ts').Param[], result: import('../../types.ts').Type, body: import('../../types.ts').Term) => import('../../types.ts').Module} */
const one = (params, result, body) => ({ imports: [], functions: [['f', fn(params, result, body)]], exports: [] })

/** A range as the note spells it, or `bot`. @type {(r: import('./types.ts').Range) => string} */
const shown = r => r === null ? 'bot' : show(r)

/** Both sides of a transfer. @type {(pair: readonly [import('./types.ts').Range, import('./types.ts').Range]) => string} */
const pair = ([a, b]) => `${shown(a)} x ${shown(b)}`

/** Whether `op(a, b)` holds as a concrete comparison. @type {(op: 'lt' | 'le' | 'eq', a: bigint, b: bigint) => boolean} */
const holdsAs = (op, a, b) => op === 'lt' ? a < b : op === 'le' ? a <= b : a === b

/**
 * Every concrete pair in `A × B` with outcome `holds` lies in the transfer's
 * `A′ × B′` (sound over-approximation).
 *
 * @type {(op: 'lt' | 'le' | 'eq', holds: boolean, A: import('../../types.ts').Int, B: import('../../types.ts').Int) => boolean}
 */
const sound = (op, holds, A, B) => {
    const [Ap, Bp] = compared(op, holds, A, B)
    /** @type {(r: import('./types.ts').Range, v: bigint) => boolean} */
    const inR = (r, v) => r !== null && r[1] <= v && v <= r[2]
    for (let a = A[1]; a <= A[2]; a += 1n) {
        for (let b = B[1]; b <= B[2]; b += 1n) {
            if (holdsAs(op, a, b) === holds && !(inR(Ap, a) && inR(Bp, b))) { return false }
        }
    }
    return true
}

export const proof = {
    // Lattice: ⊥ ⊑ R, inclusion, join is convex hull, meet is intersection.
    lattice: () => {
        const a = int(1n, 3n)
        const b = int(2n, 5n)
        const c = int(0n, 10n)
        assert(sub(null, a))
        assert(sub(a, a))
        assert(sub(a, c))
        assert(!sub(c, a))
        assert(same(join(null, a), a))
        assert(same(join(a, null), a))
        assert(same(join(a, b), int(1n, 5n)))
        assert(same(meet(a, b), int(2n, 3n)))
        assert(same(meet(a, int(4n, 5n)), null))
        assert(same(meet(null, a), null))
        assert(same(range(3n, 2n), null))
        assert(same(range(2n, 2n), int(2n, 2n)))
        // join / meet with inclusion
        assert(sub(a, join(a, b)))
        assert(sub(b, join(a, b)))
        assert(sub(meet(a, b), a))
        assert(sub(meet(a, b), b))
    },
    // Transfer table: each row of the note for representative ranges.
    transfer: () => {
        const A = int(0n, 1n)
        const B = int(0n, 1n)
        // note's lt example: true is int(0,0)×int(1,1); false stays the full A×B (shown as u(1))
        assertEq(pair(compared('lt', true, A, B)), 'int(0, 0) x int(1, 1)')
        assertEq(pair(compared('lt', false, A, B)), 'u(1) x u(1)')
        const s = int(0n, 255n)
        const ten = int(10n, 10n)
        assertEq(pair(compared('lt', true, s, ten)), 'int(0, 9) x int(10, 10)')
        assertEq(pair(compared('lt', false, s, ten)), 'int(10, 255) x int(10, 10)')
        assertEq(pair(compared('le', true, s, ten)), 'int(0, 10) x int(10, 10)')
        assertEq(pair(compared('le', false, s, ten)), 'int(11, 255) x int(10, 10)')
        assertEq(pair(compared('lt', true, ten, s)), 'int(10, 10) x int(11, 255)')
        assertEq(pair(compared('le', false, ten, s)), 'int(10, 10) x int(0, 9)')
        const three = int(3n, 3n)
        assertEq(pair(compared('eq', true, s, three)), 'int(3, 3) x int(3, 3)')
        assertEq(pair(compared('eq', false, s, three)), 'u(8) x int(3, 3)')
        assertEq(pair(compared('eq', false, s, int(255n, 255n))), 'int(0, 254) x int(255, 255)')
        assertEq(pair(compared('eq', false, s, int(1n, 2n))), 'u(8) x int(1, 2)')
        // empty after bounds is ⊥
        assertEq(pair(compared('lt', true, s, int(0n, 0n))), 'bot x bot')
        assertEq(pair(compared('eq', true, int(0n, 0n), int(1n, 1n))), 'bot x bot')
        // both locals bounded by each other
        const k = int(0n, 100n)
        assertEq(pair(compared('lt', true, s, k)), 'int(0, 99) x int(1, 100)')
        assertEq(pair(compared('lt', false, s, k)), 'u(8) x int(0, 100)')
        assertEq(pair(compared('le', false, s, k)), 'int(1, 255) x int(0, 100)')
    },
    // Soundness claim: every concrete pair with the arm's outcome stays in A′×B′.
    sound: () => {
        const cases = /** @type {const} */ ([
            [int(0n, 1n), int(0n, 1n)],
            [int(0n, 255n), int(10n, 10n)],
            [int(0n, 5n), int(2n, 4n)],
            [int(-2n, 2n), int(-1n, 1n)],
            [int(0n, 0n), int(0n, 0n)],
            [int(0n, 3n), int(1n, 2n)],
        ])
        for (const [A, B] of cases) {
            for (const op of /** @type {const} */ (['lt', 'le', 'eq'])) {
                assert(sound(op, true, A, B))
                assert(sound(op, false, A, B))
            }
        }
    },
    // Checker surface the arena relies on, and that learned uses the model.
    surface: () => {
        assertEq(assertOk(check(narrowing)).functions.map(([k, f]) => `${k}: ${show(f.body[0])}`).join(', '),
            'fitted: u(32), low: u(32), nonzero: int(1, 18446744073709551615), withinFive: int(-5, 5)')
        const s = get('s')
        const p = /** @type {const} */ ([['s', u(8)], ['k', int(0n, 100n)], ['b', u(64)]])
        assertEq(bodyType(one(p, u(64), if_(lt(s, n(10n)), s, n(0n)))), 'int(0, 9)')
        assertEq(bodyType(one(p, u(64), if_(ne(get('b'), n(0n)), get('b'), n(1n)))), 'int(1, 18446744073709551615)')
        assertEq(bodyType(one(p, u(64), if_(not(lt(s, n(10n))), s, n(10n)))), 'int(10, 255)')
        assertEq(bodyType(one([['a', u(32)], ['c', u(32)]], u(32),
            let_('q', add(get('a'), get('c')), q => if_(le(q, n(0xFFFF_FFFFn)), q, n(0n))))), 'u(32)')
        assertEq(bodyType(one([['x', i(64)]], int(-5n, 5n),
            if_(not(lt(get('x'), n(-5n))), if_(le(get('x'), n(5n)), get('x'), n(5n)), n(-5n)))), 'int(-5, 5)')
    },
    // Joins and loop parameters stay conservative: path-local facts do not
    // shrink locals after a match, and a loop keeps its declared upper bound.
    conservative: () => {
        const s = get('s')
        // match result is the join of arm results; the local after the match is not narrowed
        assertEq(bodyType(one([['s', u(8)]], u(8), let_('r', if_(lt(s, n(10n)), s, n(200n)), _ => s))), 'u(8)')
        assertEq(bodyType(one([['s', u(8)]], u(8), if_(lt(s, n(10n)), s, n(200n)))), 'int(0, 200)')
        // a block's br carries the value's type, not per-local refinements into the outer scope
        assertEq(bodyType(one([['s', u(8)]], u(8),
            let_('r', block('l', u(8), if_(lt(s, n(10n)), br('l', s), br('l', n(0n)))), _ => s))), 'u(8)')
        // loop parameter is the declaration (upper bound), not a path-narrowed join: a `br` that
        // repeats with 100 after a branch that saw k < 10 would fail if the parameter were int(0, 9)
        const looping = (/** @type {Parameters<typeof loop>[1]} */ params, /** @type {Parameters<typeof loop>[2]} */ body) =>
            one([], u(8), loop('l', params, body))
        assertEq(bodyType(looping([['k', u(8), n(0n)]], k =>
            if_(lt(k, n(10n)), next('l', [['k', n(100n)]]), k))), 'int(10, 255)')
        // first and next may both be narrower than the declaration (note's u(64) / int(0,0) shape)
        assertEq(bodyType(one([], u(64), loop('l', [['k', u(64), n(0n)]], k =>
            if_(eq(k, n(0n)), next('l', [['k', n(0n)]]), k)))), 'int(1, 18446744073709551615)')
        // a repeat value that does not subtype the declaration is refused (subtype, not computed join)
        assertEq(assertError(check(one([], u(8), loop('l', [['k', u(8), n(0n)]],
            () => next('l', [['k', n(256n)]]))))), 'f: k of loop l is u(8), not int(256, 256)')
        // arm of both outcomes learns nothing
        assertEq(bodyType(one([['s', u(8)]], u(8), match(lt(s, n(10n)), [[null, null, s]]))), 'u(8)')
    },
}
