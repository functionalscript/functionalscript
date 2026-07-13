import { eachEntry } from './module.f.ts'
import { error, ok, type Result } from '../../result/module.f.ts'
import type { ValidationError } from './module.f.ts'
import { assert, assertEq } from '../../../asserts/module.f.ts'

type Entries = ReadonlyArray<readonly [string, number]>

const item = (k: string, v: number): Result<number, ValidationError> =>
    v < 0 ? error({ path: [], message: `negative at ${k}` }) : ok(v * 2)

/** Mirrors `parse`'s accumulate step, kept simple (a small test list, not a `List`). */
const collect = (acc: Entries, k: string, v: number): Entries => [...acc, [k, v]]

export const proof = {
    empty: () => {
        const r = eachEntry([] as Entries, item, [] as Entries, collect)
        assert(r[0] === 'ok')
        assertEq(r[1].length, 0)
    },
    allOk: () => {
        const r = eachEntry([['a', 1], ['b', 2]] as const, item, [] as Entries, collect)
        assert(r[0] === 'ok')
        assertEq(r[1].length, 2)
        assertEq(r[1][0][0], 'a')
        assertEq(r[1][0][1], 2)
        assertEq(r[1][1][0], 'b')
        assertEq(r[1][1][1], 4)
    },
    // Mirrors `validate`'s usage: nothing is collected, only pass/fail matters.
    noAccumulate: () => {
        const r = eachEntry([['a', 1]] as const, item, undefined, () => undefined)
        assert(r[0] === 'ok')
        assertEq(r[1], undefined)
    },
    firstErrorWins: () => {
        const r = eachEntry([['a', -1], ['b', -2]] as const, item, [] as Entries, collect)
        assert(r[0] === 'error')
        assertEq(r[1].message, 'negative at a')
    },
    shortCircuits: () => {
        let calls = 0
        const counting = (k: string, v: number): Result<number, ValidationError> => {
            calls++
            return item(k, v)
        }
        const r = eachEntry([['a', -1], ['b', -2], ['c', -3]] as const, counting, [] as Entries, collect)
        assert(r[0] === 'error')
        assertEq(calls, 1)
    },
    pathPrefixed: () => {
        const nested = (k: string, v: number): Result<number, ValidationError> =>
            v < 0 ? error({ path: ['inner'], message: 'bad' }) : ok(v)
        const r = eachEntry([['outer', -1]] as const, nested, [] as Entries, collect)
        assert(r[0] === 'error')
        assertEq(r[1].path.length, 2)
        assertEq(r[1].path[0], 'outer')
        assertEq(r[1].path[1], 'inner')
    },
}
