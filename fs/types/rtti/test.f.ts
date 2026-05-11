import { analyzeOr, number, or, orAnalysis, string, type Type } from './module.f.ts'

type Tests = {
    readonly[K in string]: readonly unknown[]
}

const tests: Tests = {
    undefined: [undefined],
    boolean: [true, false],
    string: ['hello'],
    number: [3],
    bigint: [4n],
    object: [null, {}, []],
    function: [() => undefined]
}

const assertOk = ([k]: readonly [string, unknown]) => { if (k !== 'ok') { throw 'expected ok' } }
const assertError = ([k]: readonly [string, unknown]) => { if (k !== 'error') { throw 'expected error' } }

export default {
    typeof: Object.fromEntries(Object.entries(tests).map(([k, a]) => [k, a.map(v => () => {
        if (typeof v !== k) { throw `typeof ${v} !== ${k}` }
    })])),
    or: {
        analysis: {
            primitivesGroupedIntoSet: () => {
                const a = analyzeOr([false, 42, 'hello', null, undefined, 7n])
                if (a.primitives.size !== 6) { throw `expected 6 primitives, got ${a.primitives.size}` }
                if (a.others.length !== 0) { throw `expected 0 others, got ${a.others.length}` }
                if (!a.primitives.has(false)) { throw 'missing false' }
                if (!a.primitives.has(42)) { throw 'missing 42' }
                if (!a.primitives.has('hello')) { throw 'missing hello' }
                if (!a.primitives.has(null)) { throw 'missing null' }
                if (!a.primitives.has(undefined)) { throw 'missing undefined' }
                if (!a.primitives.has(7n)) { throw 'missing 7n' }
            },
            thunksGoToOthers: () => {
                const a = analyzeOr([number, string])
                if (a.primitives.size !== 0) { throw 'expected no primitives' }
                if (a.others.length !== 2) { throw `expected 2 others, got ${a.others.length}` }
            },
            objectsAndTuplesGoToOthers: () => {
                const a = analyzeOr([{ a: 1 } as Type, [1, 2] as readonly Type[]])
                if (a.primitives.size !== 0) { throw 'expected no primitives' }
                if (a.others.length !== 2) { throw `expected 2 others, got ${a.others.length}` }
            },
            mixedSplitCorrectly: () => {
                const a = analyzeOr([42, number, 'hello', string])
                if (a.primitives.size !== 2) { throw `expected 2 primitives, got ${a.primitives.size}` }
                if (a.others.length !== 2) { throw `expected 2 others, got ${a.others.length}` }
                if (!a.primitives.has(42)) { throw 'missing 42' }
                if (!a.primitives.has('hello')) { throw 'missing hello' }
            },
            duplicatesDeduplicated: () => {
                const a = analyzeOr([42, 42, 'a', 'a'])
                if (a.primitives.size !== 2) { throw `expected 2 primitives, got ${a.primitives.size}` }
            },
            othersPreserveOrder: () => {
                const first: Type = () => ['const', 'a'] as const
                const second: Type = () => ['const', 'b'] as const
                const a = analyzeOr([first, second])
                if (a.others[0] !== first) { throw 'order changed' }
                if (a.others[1] !== second) { throw 'order changed' }
            },
        },
        orAttachesAnalysis: {
            primitives: () => {
                const t = or(false, 42, 'hello')
                const a = orAnalysis(t)
                if (a === undefined) { throw 'analysis missing' }
                if (a.primitives.size !== 3) { throw `expected 3 primitives, got ${a.primitives.size}` }
                if (a.others.length !== 0) { throw 'expected 0 others' }
            },
            mixed: () => {
                const t = or(42, number)
                const a = orAnalysis(t)
                if (a === undefined) { throw 'analysis missing' }
                if (a.primitives.size !== 1) { throw 'expected 1 primitive' }
                if (a.others.length !== 1) { throw 'expected 1 other' }
            },
            manuallyConstructedThunkHasNoAnalysis: () => {
                const manual: Type = () => ['or', 1, 2, 3] as const
                const a = orAnalysis(manual)
                if (a !== undefined) { throw 'expected undefined for manual thunk' }
            },
        },
    },
}
