import { fixpoint, fn, iterate } from './module.f.js'
import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'

export const proof = () => {
    /** @type {(x: string) => readonly [string]} */
    const f = x => [x]
    /** @type {(x: readonly [string]) => readonly [number]} */
    const g = ([x]) => [x.length]
    /** @type {(x: readonly [number]) => number} */
    const w = ([x]) => x

    const r = fn(f).map(g).map(w).result

    const result = r('hello')
    assertEq(result, 5, r)

    assertEq(iterate(0n)(5)(x => x + 1), 5, iterate)
    assertEq(iterate(1n)(5)(x => x + 1), 6, iterate)
    assertEq(iterate(3n)(5)(x => x + 1), 8, iterate)
    assertEq(iterate(-1n)(5)(x => x + 1), 5, iterate)

    // Each step appends its call number: both even and odd splits preserve
    // the exact application count and sequential state passed to the next call.
    /** @type {readonly [number, number]} */
    const initial = [0, 0]
    /** @type {(state: readonly [number, number]) => readonly [number, number]} */
    const next = ([calls, value]) => [calls + 1, value * 10 + calls + 1]
    assertEq(iterate(0n)(initial)(next), initial, iterate)
    assertStructurallySame(iterate(4n)(initial)(next), [4, 1234], iterate)
    assertStructurallySame(iterate(5n)(initial)(next), [5, 12345], iterate)

    // A linear recursive rewrite would exhaust the stack at this count.
    assertEq(iterate(100_000n)(0n)(x => x + 1n), 100_000n, iterate)

    // A round per step, and no frame per round: a hundred thousand rounds
    // are a stack overflow as a recursion and nothing as a loop.
    assertEq(fixpoint((/** @type {number} */ n) => n < 100_000 ? n + 1 : n, (a, b) => a === b)(0), 100_000, fixpoint)
    // `same` decides the last round, so a round that rebuilds an equal array
    // ends the loop where `===` never would.
    /** @type {(a: readonly number[]) => readonly number[]} */
    const grow = a => a.length < 3 ? [...a, a.length] : [...a]
    assertStructurallySame(fixpoint(grow, (a, b) => a.length === b.length)([]), [0, 1, 2], fixpoint)
}
