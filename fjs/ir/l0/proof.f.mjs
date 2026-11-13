import { assertEq, assertOk } from '../../asserts/module.f.js'
import { BIGINT, NUMBER } from '../../wasm/runtime/l0/module.f.js'
import { check } from '../check/module.f.mjs'
import { show } from '../print/module.f.mjs'
import { any, l0 } from './module.f.mjs'

export const proof = {
    // The variants of `any` are the L0 view's kinds in the order of its tags, which `kind` answers.
    variants: () => {
        const [, { types: [[name, { variants, kind, carrier }]], functions }] = l0[0]
        assertEq(name, 'any')
        assertEq(variants.join(), 'undefined,null,boolean,number,string,bigint,array,object,function')
        assertEq(variants.indexOf('number'), NUMBER)
        assertEq(variants.indexOf('bigint'), BIGINT)
        assertEq(`${kind} ${carrier} ${functions.map(([k]) => k).join()}`, 'kind i64 kind,to_f64,to_bool')
    },
    // Every parameter of an L0 function narrows `any` to the kinds that the function takes.
    signatures: () => assertEq(l0.flatMap(([m, { functions }]) => functions.map(([f, { params, result }]) =>
        `${m}.${f}(${params.map(([k, t]) => `${k}: ${show(t)}`).join(', ')}) -> ${show(result)}`)).join('; '), [
        'Any.kind(v: any) -> int(0, 8)',
        'Any.to_f64(v: any.only(number)) -> f64c',
        'Any.to_bool(v: any.only(boolean)) -> bool',
        'String.length(s: any.only(string)) -> u(31)',
        'BigInt.length(b: any.only(bigint)) -> u(31)',
        'Containers.length(c: any.only(array, object)) -> u(31)',
        'Functions.length(f: any.only(function)) -> u(31)',
    ].join('; ')),
    // A module may import all of them: the checker takes the interfaces.
    checked: () => assertEq(assertOk(check({ imports: l0, functions: [], exports: [] })).imports.map(([k]) => k).join(), 'Any,String,BigInt,Containers,Functions'),
    any: () => assertEq(show(any), 'any'),
}
