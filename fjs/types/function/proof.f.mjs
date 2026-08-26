import { fn, iterate } from './module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

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
    assertEq(iterate(3n)(5)(x => x + 1), 8, iterate)
    assertEq(iterate(-1n)(5)(x => x + 1), 5, iterate)
}
