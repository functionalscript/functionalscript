import type { Map } from '../object/module.f.ts'

type Tests = Map<readonly unknown[]>

const tests: Tests = {
    undefined: [undefined],
    boolean: [true, false],
    string: ['hello'],
    number: [3],
    bigint: [4n],
    object: [null, {}, []],
    function: [() => undefined]
}

export const proof = {
    typeof: Object.fromEntries(Object.entries(tests).map(([k, a]) => [k, a!.map(v => () => {
        if (typeof v !== k) { throw `typeof ${v} !== ${k}` }
    })])),
}
