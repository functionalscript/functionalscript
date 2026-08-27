/**
 * @import { StringMap } from '../types/object/types.ts'
 * @import { Assert } from '../asserts/types.ts'
 * @import { Equal } from '../types/ts/types.ts'
 * @import { Or, Rest, Type1, Unknown } from './types.ts'
 */

import { assertNotNullish, assertStructurallySame } from '../asserts/module.f.mjs'
import { array, number, open, option, or, record, rest, string, unknown } from './module.f.mjs'

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

// `or`, `option`, `array`, `record`, `rest` and `open` take `const` type
// parameters, so a literal written at the call site stays a literal: `or(42, string)`
// describes `42 | string`, not `number | string`. Without the modifier a caller
// has to pin every literal with an `@type {const}` cast, and the assertions
// below are what fail if one of the modifiers is dropped. Each is paired with
// the thunk's own output, so the schema a call *builds* is checked next to the
// type it is given.
const constInference = () => {
    const orConst = or(42, string)
    /** @typedef {Assert<Equal<typeof orConst, Or<readonly [42, typeof string]>>>} _OrConst */
    assertStructurallySame(orConst(), ['or', 42, string])

    const optionConst = option([42, string])
    /** @typedef {Assert<Equal<typeof optionConst, Or<readonly [readonly [42, typeof string], undefined]>>>} _OptionConst */
    assertStructurallySame(optionConst(), ['or', [42, string], undefined])

    const arrayConst = array('hello')
    /** @typedef {Assert<Equal<typeof arrayConst, Type1<'array', 'hello'>>>} _ArrayConst */
    assertStructurallySame(arrayConst(), ['array', 'hello'])

    const recordConst = record({ a: number })
    /** @typedef {Assert<Equal<typeof recordConst, Type1<'record', { readonly a: typeof number }>>>} _RecordConst */
    assertStructurallySame(recordConst(), ['record', { a: number }])

    const restConst = rest({ a: 42 }, string)
    /** @typedef {Assert<Equal<typeof restConst, Rest<{ readonly a: 42 }, typeof string>>>} _RestConst */
    assertStructurallySame(restConst(), ['rest', { a: 42 }, string])

    // `open` needs the modifier of its own — it is not `rest` partially
    // applied, so dropping it there widens `[42, string]` to `Type[]` while
    // every assertion above still passes.
    const openConst = open([42, string])
    /** @typedef {Assert<Equal<typeof openConst, Rest<readonly [42, typeof string], Unknown>>>} _OpenConst */
    assertStructurallySame(openConst(), ['rest', [42, string], unknown])
}

export const proof = {
    constInference,
    typeof: Object.fromEntries(Object.entries(tests).map(([k, a]) => [k, assertNotNullish(a).map(v => () => {
        if (typeof v !== k) { throw `typeof ${v} !== ${k}` }
    })])),
}
