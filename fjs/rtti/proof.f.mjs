/**
 * @import { StringMap } from '../types/object/types.ts'
 * @import { Assert } from '../asserts/types.ts'
 * @import { Equal } from '../types/ts/types.ts'
 * @import { Option, Or, Rest, Type1, Unknown } from './types.ts'
 */

import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../asserts/module.f.js'
import { array, number, open, option, or, record, rest, string, unknown } from './module.f.mjs'
import { examples, lessons, projectSchemas } from './demo.f.mjs'
import { _readersOf } from './schema-demo/module.f.mjs'

/** @type {StringMap<readonly unknown[]>} */
const tests = {
    undefined: [undefined],
    boolean: [true, false],
    string: ['hello'],
    number: [3],
    bigint: [4n],
    object: [null, {}, []],
    function: [() => undefined]
}

// `or`, `array`, `record`, `rest` and `open` take `const` type parameters, so
// a literal written at the call site stays a literal: `or(42, string)`
// describes `42 | string`, not `number | string`. Without the modifier a caller
// has to pin every literal with an `@type {const}` cast, and the assertions
// below are what fail if one of the modifiers is dropped. Each is paired with
// the thunk's own output, so the schema a call *builds* is checked next to the
// type it is given.
const constInference = () => {
    const orConst = or(42, string)
    /** @typedef {Assert<Equal<typeof orConst, Or<readonly [42, typeof string]>>>} _OrConst */
    assertStructurallySame(orConst(), ['or', 42, string])

    // `option` is nullary — absence itself, not a wrapper — so the spelling
    // under test is the union that carries it.
    const optionUnion = or(option, [42, string])
    /** @typedef {Assert<Equal<typeof option, Option>>} _OptionNullary */
    /** @typedef {Assert<Equal<typeof optionUnion, Or<readonly [Option, readonly [42, typeof string]]>>>} _OptionUnion */
    assertStructurallySame(option(), ['option'])
    assertStructurallySame(optionUnion(), ['or', option, [42, string]])

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

const demoProof = /** @type {const} */ ({
    // The module comment and the README count the examples — nine lessons,
    // five single and four pairs, and fourteen project schemas — so a change
    // to either list fails here and points at the two places that say it.
    counts: () => {
        assertEq(lessons.length, 9)
        assertEq(lessons.filter(e => e.schemas.length === 2).length, 4)
        assertEq(projectSchemas.length, 14)
        assertEq(examples.length, lessons.length + projectSchemas.length)
    },
    // Every project schema's value is one the schema accepts, on both
    // readers: the reader starts from a working document, and a change to a
    // schema that stops accepting it fails here rather than on the page.
    projectValuesAccepted: () => {
        for (const e of projectSchemas) {
            const r = _readersOf(e.schemas[0].schema)(e.value)
            assert(!('error' in r) && r.parse.ok && r.validate.ok, `${e.name}: ${JSON.stringify(r)}`)
        }
    },
})

export const proof = {
    constInference,
    demo: demoProof,
    typeof: Object.fromEntries(Object.entries(tests).map(([k, a]) => [k, assertNotNullish(a).map(v => () => {
        assertEq(typeof v, k)
    })])),
}
