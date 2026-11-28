/**
 * Proofs of Any's IR module: the plain stage, the lifetime pass's owned
 * stage, the printed hooks, and that each L0 Any export shares its WASM
 * type with this module's export of that name
 * ([defined-hooks.md](../../../../doc/sasha-gil/ir/defined-hooks.md)).
 */

import { assert, assertEq, assertOk } from '../../../asserts/module.f.js'
import { wat } from '../../../media/wasm/wat/module.f.js'
import { check, checkPlain } from '../../check/module.f.js'
import { l0, string } from '../../l0/module.f.js'
import { lifetime } from '../../lifetime/module.f.js'
import { definedBy, fn, lit } from '../../module.f.js'
import { print } from '../../print/module.f.js'
import { emit } from '../../wasm/module.f.js'
import { checked, iface, module } from './module.f.js'

/** @type {(m: import('../../types.ts').Module) => string} */
const emittedWat = m => wat(emit(assertOk(check(assertOk(lifetime(m))))))

/**
 * The names of a module's functions that may fail, joined by commas.
 * @type {(m: import('../../types.ts').Module) => string}
 */
const failing = m => assertOk(checkPlain(m)).functions.flatMap(([k, { fails }]) => fails ? [k] : []).join()

export const proof = {
    // The module defines Any with number among the copy variants, and imports only Ref.
    shape: () => {
        assertEq(module.imports.map(([k]) => k).join(), 'Ref')
        assertEq(definedBy(module), 'Any')
        const defines = module.defines
        assert(defines !== undefined)
        const [[name, def]] = defines.types
        assertEq(name, 'any')
        assertEq(def.copy?.join(), 'undefined,null,boolean,number')
        assertEq(`${def.kind} ${def.carrier} ${def.dup} ${def.drop}`, 'kind i64 dup drop')
        assertEq(`${def.literal?.module}.${def.literal?.member}`, 'String.make_string')
    },
    // The importer interface is L0's Any with number in copy, and the same string-literal maker.
    iface: () => {
        const [, def] = iface.types[0]
        assertEq(def.copy?.join(), 'undefined,null,boolean,number')
        assertEq(`${def.literal?.module}.${def.literal?.member}`, 'String.make_string')
        assertEq(iface.functions.map(([k]) => k).join(), 'kind,to_f64,from_f64,to_bool,from_bool,same,dup,drop')
        const [, l0Iface] = l0[0]
        assertEq(l0Iface.functions.map(([k]) => k).join(), iface.functions.map(([k]) => k).join())
        assertEq(l0Iface.constants?.map(([k]) => k).join(), iface.constants?.map(([k]) => k).join())
        assertEq(l0Iface.types[0][1].literal?.member, def.literal?.member)
        // a module that imports iface in place of L0 Any still accepts a string literal
        const stringEntry = l0.find(([k]) => k === 'String')
        assert(stringEntry !== undefined)
        const [, stringIface] = stringEntry
        assertOk(checkPlain({
            imports: [['Any', iface], ['String', stringIface]],
            functions: [['hello', fn([], string, () => lit(string, 'hi'))]],
            exports: ['hello'],
        }))
    },
    // The plain stage types every function; the owned stage after the lifetime pass does too.
    checked: () => {
        assertEq(assertOk(checkPlain(module)).functions.map(([k]) => k).join(),
            'isRef,dup,drop,kind,to_f64,from_f64,to_bool,from_bool,same,keep,take,forget,undefinedOf,nullOf,falseOf,trueOf')
        assertEq(assertOk(check(assertOk(lifetime(module)))).functions.map(([k]) => k).join(),
            'isRef,dup,drop,kind,to_f64,from_f64,to_bool,from_bool,same,keep,take,forget,undefinedOf,nullOf,falseOf,trueOf')
    },
    // The lifetime pass copies and drops through the hooks on bits.
    lifetime: () => {
        const text = print(assertOk(lifetime(module)))
        assert(text.includes('fn keep(v: any) -> any =\n    seal(any, dup(unseal(v)))'))
        assert(text.includes('let $1 = drop(release(v))'))
        assert(text.includes('fn dup(b: u(64)) -> u(64) =\n    if isRef(b) then Ref.dup_ref(b) else b'))
        assert(text.includes('fn drop(b: u(64)) -> unit =\n    if isRef(b) then Ref.drop_ref(b) else {}'))
        assert(text.includes('copy: undefined | null | boolean | number'))
    },
    // Each named export that L0's Any has shares that export's WASM type here.
    wasmTypes: () => {
        const text = emittedWat(module)
        assert(text.includes('(export "kind" (func $kind))'))
        assert(text.includes('(export "to_f64" (func $to_f64))'))
        assert(text.includes('(export "from_f64" (func $from_f64))'))
        assert(text.includes('(export "to_bool" (func $to_bool))'))
        assert(text.includes('(export "from_bool" (func $from_bool))'))
        assert(text.includes('(export "same" (func $same))'))
        assert(text.includes('(export "dup" (func $dup))'))
        assert(text.includes('(export "drop" (func $drop))'))
        // kind / to_bool / same / isRef: (i64) -> i32; to_f64: (i64) -> f64; from_f64: (f64) -> i64; from_bool: (i32) -> i64; dup: (i64) -> i64; drop: (i64) -> ()
        assert(text.includes('(func $kind ') && text.includes('(param $v i64) (result i32)'))
        assert(text.includes('(func $to_f64 ') && text.includes('(param $v i64) (result f64)'))
        assert(text.includes('(func $from_f64 ') && text.includes('(param $x f64) (result i64)'))
        assert(text.includes('(func $to_bool ') && text.includes('(param $v i64) (result i32)'))
        assert(text.includes('(func $from_bool ') && text.includes('(param $b i32) (result i64)'))
        assert(text.includes('(func $same ') && text.includes('(param $a i64) (param $b i64) (result i32)'))
        assert(text.includes('(func $dup ') && text.includes('(param $b i64) (result i64)'))
        assert(text.includes('(func $drop ') && text.includes('(param $b i64)'))
        assert(text.includes('(import "fjs:l0" "dup_ref"'))
        assert(text.includes('(import "fjs:l0" "drop_ref"'))
        assert(text.includes('(import "fjs:l0" "kind_ref"'))
        assert(text.includes('(import "fjs:l0" "same_ref"'))
    },
    // `kind` reads a reference's kind from its `tttt` bits; the checked
    // variant asks L0's `kind_ref`, which also refuses a dead reference.
    kindOfRef: () => {
        assert(!emittedWat(module).includes('call $Ref.kind_ref'))
        assert(emittedWat(checked).includes('call $Ref.kind_ref'))
        assertEq(assertOk(checkPlain(checked)).functions.map(([k]) => k).join(),
            assertOk(checkPlain(module)).functions.map(([k]) => k).join())
    },
    // Forged bits trap as a misuse in both variants, so no function of either may fail, as the interface says of each.
    effect: () => {
        assertEq(failing(module), '')
        assertEq(failing(checked), '')
        assert(iface.functions.every(([, { fails }]) => fails !== true))
    },
}
