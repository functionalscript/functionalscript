import { eachEntry } from './module.f.ts'
import { error, ok, type Result } from '../../result/module.f.ts'
import type { ValidationError } from './module.f.ts'

const item = (k: string, v: number): Result<number, ValidationError> =>
    v < 0 ? error({ path: [], message: `negative at ${k}` }) : ok(v * 2)

export const proof = {
    empty: () => {
        const r = eachEntry<number, number>([], item)
        if (r[0] !== 'ok' || r[1].length !== 0) { throw 'expected ok []' }
    },
    allOk: () => {
        const r = eachEntry([['a', 1], ['b', 2]] as const, item)
        if (r[0] !== 'ok') { throw 'expected ok' }
        if (r[1].length !== 2 || r[1][0][0] !== 'a' || r[1][0][1] !== 2 || r[1][1][0] !== 'b' || r[1][1][1] !== 4) {
            throw `unexpected entries ${JSON.stringify(r[1])}`
        }
    },
    firstErrorWins: () => {
        const r = eachEntry([['a', -1], ['b', -2]] as const, item)
        if (r[0] !== 'error') { throw 'expected error' }
        if (r[1].message !== 'negative at a') { throw `expected the first entry's error, got ${r[1].message}` }
    },
    shortCircuits: () => {
        let calls = 0
        const counting = (k: string, v: number): Result<number, ValidationError> => {
            calls++
            return item(k, v)
        }
        const r = eachEntry([['a', -1], ['b', -2], ['c', -3]] as const, counting)
        if (r[0] !== 'error') { throw 'expected error' }
        if (calls !== 1) { throw `expected exactly one call, got ${calls}` }
    },
    pathPrefixed: () => {
        const nested = (k: string, v: number): Result<number, ValidationError> =>
            v < 0 ? error({ path: ['inner'], message: 'bad' }) : ok(v)
        const r = eachEntry([['outer', -1]] as const, nested)
        if (r[0] !== 'error') { throw 'expected error' }
        if (r[1].path.length !== 2 || r[1].path[0] !== 'outer' || r[1].path[1] !== 'inner') {
            throw `expected path ['outer', 'inner'], got ${JSON.stringify(r[1].path)}`
        }
    },
}
