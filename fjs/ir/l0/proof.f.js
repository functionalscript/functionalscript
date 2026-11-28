import { assertEq, assertOk } from '../../asserts/module.f.js'
import { ARRAY, BIGINT, BOOLEAN, FUNCTION, NULL, NUMBER, OBJECT, STRING, UNDEFINED, kind as viewKind } from '../../wasm/runtime/l0/module.f.js'
import { check } from '../check/module.f.js'
import { show } from '../print/module.f.js'
import { any, kinds, l0, memory } from './module.f.js'

export const proof = {
    // The variants of `any` are the L0 view's kinds in the order of its tags, which `kind` answers.
    variants: () => {
        const [, { types: [[name, { variants, kind, carrier, dup, drop }]], functions }] = l0[0]
        assertEq(name, 'any')
        assertEq(variants, kinds)
        assertEq(kinds.join(), 'undefined,null,boolean,number,string,bigint,array,object,function')
        assertEq([UNDEFINED, NULL, BOOLEAN, NUMBER, STRING, BIGINT, ARRAY, OBJECT, FUNCTION].join(), '0,1,2,3,4,5,6,7,8')
        assertEq([undefined, null, true, 1, '', 1n, [], {}, () => 0].map(viewKind).join(), '0,1,2,3,4,5,6,7,8')
        assertEq(`${kind} ${carrier} ${dup} ${drop} ${functions.map(([k]) => k).join()}`, 'kind i64 dup drop kind,to_f64,from_f64,to_bool,from_bool,same,dup,drop')
    },
    // Every parameter of an L0 function narrows `any` to the kinds that the function takes.
    signatures: () => assertEq(l0.flatMap(([m, { functions }]) => functions.map(([f, { params, result, fails }]) =>
        `${m}.${f}(${params.map(([k, t, mode]) => `${mode === 'own' ? 'own ' : ''}${k}: ${show(t)}`).join(', ')}) -> ${show(result)}${fails === true ? ' may fail' : ''}`)).join('; '), [
        'Any.kind(v: any) -> int(0, 8)',
        'Any.to_f64(v: any.only(number)) -> f64c',
        'Any.from_f64(x: f64) -> any.only(number)',
        'Any.to_bool(v: any.only(boolean)) -> bool',
        'Any.from_bool(b: bool) -> any.only(boolean)',
        'Any.same(a: any.only(array, object, function), b: any.only(array, object, function)) -> bool',
        'Any.dup(v: any) -> any',
        'Any.drop(own v: any) -> unit',
        'String.length(s: any.only(string)) -> u(31)',
        'String.unit(s: any.only(string), i: u(31)) -> u(16) may fail',
        'String.from_unit(c: u(16)) -> any.only(string)',
        'String.concat(a: any.only(string), b: any.only(string)) -> any.only(string)',
        'String.substring(s: any.only(string), start: u(31), end: u(31)) -> any.only(string) may fail',
        'BigInt.length(b: any.only(bigint)) -> u(31)',
        'Containers.length(c: any.only(array, object)) -> u(31)',
        'Containers.item(c: any.only(array, object), i: u(31)) -> any may fail',
        'Containers.find(o: any.only(object), k: any.only(string)) -> i(32)',
        'Containers.begin_array(n: u(31)) -> builder',
        'Containers.begin_object(n: u(31)) -> builder',
        'Containers.push(own b: builder, own v: any) -> builder may fail',
        'Containers.push_all(own b: builder, a: any.only(array)) -> builder may fail',
        'Containers.push_property(own b: builder, own k: any.only(string), own v: any) -> builder may fail',
        'Containers.seal(own b: builder) -> any.only(array, object) may fail',
        'Containers.join(parts: any.only(array), separator: any.only(string)) -> any.only(string) may fail',
        'Containers.key(o: any.only(object), i: u(31)) -> any.only(string) may fail',
        'Functions.length(f: any.only(function)) -> u(31)',
        'Functions.make_function(c: code([any.only(function), any.only(array)], any), own frame: any.only(array), length: u(31), own text: any.only(string, undefined)) -> any.only(function)',
        'Functions.call(f: any.only(function), args: any.only(array)) -> any may fail',
        'Functions.text(f: any.only(function)) -> any.only(string, undefined)',
        'Functions.throw(own v: any) -> never may fail',
        'Functions.frame(self: any.only(function), i: u(31)) -> any may fail',
    ].join('; ')),
    // A module may import all of them: the checker takes the interfaces.
    checked: () => assertEq(assertOk(check({ imports: l0, functions: [], exports: [] })).imports.map(([k]) => k).join(), 'Any,String,BigInt,Containers,Functions'),
    any: () => assertEq(show(any), 'any'),
    // Memory is the target's, beside L0's interfaces and of their ABI: a load and a store of each width, the size and
    // grow, none of which may fail, since an address past the memory is a misuse (heap.md, Memory in the IR).
    memory: () => {
        const [name, { abi, instructions, types, functions }] = memory
        assertEq(`${name} ${abi} ${instructions} ${types.length}`, 'Memory fjs:l0 true 0')
        assertEq(functions.map(([f, { params, result }]) => `${f}(${params.map(([k, t]) => `${k}: ${show(t)}`).join(', ')}) -> ${show(result)}`).join('; '), [
            'load8(a: u(32)) -> u(8)',
            'load16(a: u(32)) -> u(16)',
            'load32(a: u(32)) -> u(32)',
            'load64(a: u(32)) -> u(64)',
            'store8(a: u(32), v: u(8)) -> unit',
            'store16(a: u(32), v: u(16)) -> unit',
            'store32(a: u(32), v: u(32)) -> unit',
            'store64(a: u(32), v: u(64)) -> unit',
            'size() -> int(0, 65536)',
            'grow(n: int(0, 65536)) -> int(-1, 65536)',
        ].join('; '))
        assertEq(functions.filter(([, s]) => s.fails === true || s.counts !== undefined || s.returns !== undefined || s.params.some(p => p[2] === 'own')).length, 0)
        assertEq(assertOk(check({ imports: [...l0, memory], functions: [], exports: [] })).imports.map(([k]) => k).join(), 'Any,String,BigInt,Containers,Functions,Memory')
    },
}
