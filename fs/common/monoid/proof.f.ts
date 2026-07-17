import { repeat, type Monoid } from "./module.f.ts";
import { assert } from '../../asserts/module.f.ts'

export const proof = {
    numberAdd: () => {
        const add: Monoid<number> = {
             identity: 0,
             operation: a => b => a + b,
        };
        const resultAdd = repeat(add)(10n)(2) // 20
        assert(resultAdd === 20, resultAdd)

        const id = repeat(add)(0n)(42)
        assert(id === 0, id)
    },
    stringConcat: () => {
        const concat: Monoid<string> = {
             identity: '',
             operation: a => b => a + b,
        };

        const resultConcat = repeat(concat)(3n)('ha') // 'hahaha'
        assert(resultConcat === 'hahaha', resultConcat)
    }
}
