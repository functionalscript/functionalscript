import { assertEq, assertError, assertOk } from '../../asserts/module.f.js'
import { check } from '../check/module.f.mjs'
import { l0 } from '../l0/module.f.js'
import { show } from '../print/module.f.js'
import { native } from './module.f.js'

export const proof = {
    // A row takes what its body checks: bigints of `any`, or floats.
    signatures: () => assertEq(native.functions.map(([f, { params, result }]) =>
        `${f}(${params.map(([k, t]) => `${k}: ${show(t)}`).join(', ')}) -> ${show(result)}`).join('; '), [
        'bigintEquals(a: any.only(bigint), b: any.only(bigint)) -> bool',
        'numberRemainder(a: f64, b: f64) -> f64',
    ].join('; ')),
    // A module may import it beside L0, which seals its values of `any`, and not without.
    checked: () => {
        assertEq(assertOk(check({ imports: [...l0, ['Native', native]], functions: [], exports: [] })).imports.length, 6)
        assertEq(assertError(check({ imports: [['Native', native]], functions: [], exports: [] })), 'Native: no interface Any')
    },
}
