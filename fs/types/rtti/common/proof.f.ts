import { eachEntry } from './module.f.ts'
import { error, ok, type Result } from '../../result/module.f.ts'
import type { ValidationError } from './module.f.ts'
import { assert, assertEq } from '../../../asserts/module.f.ts'

const item = (k: string, v: number): Result<number, ValidationError> =>
    v < 0 ? error({ path: [], message: `negative at ${k}` }) : ok(v * 2)

export const proof = {
    empty: () => {
        const r = eachEntry<number, number>([], item)
        assert(r[0] === 'ok')
        assertEq(r[1].length, 0)
    },
    allOk: () => {
        const r = eachEntry([['a', 1], ['b', 2]] as const, item)
        assert(r[0] === 'ok')
        assertEq(r[1].length, 2)
        assertEq(r[1][0][0], 'a')
        assertEq(r[1][0][1], 2)
        assertEq(r[1][1][0], 'b')
        assertEq(r[1][1][1], 4)
    },
    firstErrorWins: () => {
        const r = eachEntry([['a', -1], ['b', -2]] as const, item)
        assert(r[0] === 'error')
        assertEq(r[1].message, 'negative at a')
    },
    shortCircuits: () => {
        let calls = 0
        const counting = (k: string, v: number): Result<number, ValidationError> => {
            calls++
            return item(k, v)
        }
        const r = eachEntry([['a', -1], ['b', -2], ['c', -3]] as const, counting)
        assert(r[0] === 'error')
        assertEq(calls, 1)
    },
    pathPrefixed: () => {
        const nested = (k: string, v: number): Result<number, ValidationError> =>
            v < 0 ? error({ path: ['inner'], message: 'bad' }) : ok(v)
        const r = eachEntry([['outer', -1]] as const, nested)
        assert(r[0] === 'error')
        assertEq(r[1].path.length, 2)
        assertEq(r[1].path[0], 'outer')
        assertEq(r[1].path[1], 'inner')
    },
}
