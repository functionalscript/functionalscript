/**
 * @import { StringMap } from '../object/types.ts'
 */

/** @typedef {StringMap<readonly unknown[]>} _Tests */

/** @type {_Tests} */
const tests = {
    undefined: [undefined],
    boolean: [true, false],
    string: ['hello'],
    number: [3],
    bigint: [4n],
    object: [null, {}, []],
    function: [() => undefined]
}

export const proof = {
    typeof: Object.fromEntries(Object.entries(tests).map(([k, a]) => [k, /** @type {readonly unknown[]} */ (a).map(v => () => {
        if (typeof v !== k) { throw `typeof ${v} !== ${k}` }
    })])),
}
