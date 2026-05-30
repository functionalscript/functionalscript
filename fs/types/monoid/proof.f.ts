import { repeat, type Monoid } from "./module.f.ts";

export default {
    numberAdd: () => {
        const add: Monoid<number> = {
             identity: 0,
             operation: a => b => a + b,
        };
        const resultAdd = repeat(add)(10n)(2) // 20
        if (resultAdd !== 20) { throw resultAdd }

        const id = repeat(add)(0n)(42)
        if (id !== 0) { throw id }
    },
    stringConcat: () => {
        const concat: Monoid<string> = {
             identity: '',
             operation: a => b => a + b,
        };

        const resultConcat = repeat(concat)(3n)('ha') // 'hahaha'
        if (resultConcat !== 'hahaha') { throw resultConcat }
    }
}
