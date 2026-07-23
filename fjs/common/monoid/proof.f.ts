import { repeat, fold, type Monoid } from "./module.f.ts";
import { assertEq } from '../../asserts/module.f.ts'

export const proof = {
    numberAdd: () => {
        const add: Monoid<number> = {
             identity: 0,
             operation: a => b => a + b,
        };
        const resultAdd = repeat(add)(10n)(2) // 20
        assertEq(resultAdd, 20)

        const id = repeat(add)(0n)(42)
        assertEq(id, 0)
    },
    stringConcat: () => {
        const concat: Monoid<string> = {
             identity: '',
             operation: a => b => a + b,
        };

        const resultConcat = repeat(concat)(3n)('ha') // 'hahaha'
        assertEq(resultConcat, 'hahaha')
    },
    fold: {
        nonEmpty: () => {
            const add: Monoid<number> = {
                identity: 0,
                operation: a => b => a + b,
            };
            assertEq(fold(add)([1, 2, 3, 4]), 10)
        },
        order: () => {
            // a non-commutative monoid: `fold` must preserve left-to-right order
            // (`((('' + 'a') + 'b') + 'c')`), not reverse it to `'cba'`.
            const concat: Monoid<string> = {
                identity: '',
                operation: a => b => a + b,
            };
            assertEq(fold(concat)(['a', 'b', 'c']), 'abc')
        },
        empty: () => {
            const concat: Monoid<string> = {
                identity: '',
                operation: a => b => a + b,
            };
            // an empty list folds to the identity
            assertEq(fold(concat)([]), '')
        },
    }
}
