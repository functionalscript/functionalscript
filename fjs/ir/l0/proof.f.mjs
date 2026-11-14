import { assertEq, assertOk } from '../../asserts/module.f.js'
import { ARRAY, BIGINT, BOOLEAN, FUNCTION, NULL, NUMBER, OBJECT, STRING, UNDEFINED, kind as viewKind } from '../../wasm/runtime/l0/module.f.js'
import { check } from '../check/module.f.js'
import { show } from '../print/module.f.js'
import { any, kinds, l0 } from './module.f.js'

export const proof = {
    // The variants of `any` are the L0 view's kinds in the order of its tags, which `kind` answers.
    variants: () => {
        const [, { types: [[name, { variants, kind, carrier, dup, drop }]], functions }] = l0[0]
        assertEq(name, 'any')
        assertEq(variants, kinds)
        assertEq(kinds.join(), 'undefined,null,boolean,number,string,bigint,array,object,function')
        assertEq([UNDEFINED, NULL, BOOLEAN, NUMBER, STRING, BIGINT, ARRAY, OBJECT, FUNCTION].join(), '0,1,2,3,4,5,6,7,8')
        assertEq([undefined, null, true, 1, '', 1n, [], {}, () => 0].map(viewKind).join(), '0,1,2,3,4,5,6,7,8')
        assertEq(`${kind} ${carrier} ${dup} ${drop} ${functions.map(([k]) => k).join()}`, 'kind i64 dup drop kind,to_f64,to_bool,same,dup,drop')
    },
    // Every parameter of an L0 function narrows `any` to the kinds that the function takes.
    signatures: () => assertEq(l0.flatMap(([m, { functions }]) => functions.map(([f, { params, result }]) =>
        `${m}.${f}(${params.map(([k, t, mode]) => `${mode === 'own' ? 'own ' : ''}${k}: ${show(t)}`).join(', ')}) -> ${show(result)}`)).join('; '), [
        'Any.kind(v: any) -> int(0, 8)',
        'Any.to_f64(v: any.only(number)) -> f64c',
        'Any.to_bool(v: any.only(boolean)) -> bool',
        'Any.same(a: any.only(array, object, function), b: any.only(array, object, function)) -> bool',
        'Any.dup(v: any) -> any',
        'Any.drop(own v: any) -> unit',
        'String.length(s: any.only(string)) -> u(31)',
        'String.unit(s: any.only(string), i: u(31)) -> u(16)',
        'String.from_unit(c: u(16)) -> any.only(string)',
        'String.concat(a: any.only(string), b: any.only(string)) -> any.only(string)',
        'BigInt.length(b: any.only(bigint)) -> u(31)',
        'Containers.length(c: any.only(array, object)) -> u(31)',
        'Functions.length(f: any.only(function)) -> u(31)',
    ].join('; ')),
    // A module may import all of them: the checker takes the interfaces.
    checked: () => assertEq(assertOk(check({ imports: l0, functions: [], exports: [] })).imports.map(([k]) => k).join(), 'Any,String,BigInt,Containers,Functions'),
    any: () => assertEq(show(any), 'any'),
}
