/**
 * Proofs of Any's IR module: the plain stage, the lifetime pass's owned
 * stage, the printed hooks, and that each L0 Any export shares its WASM
 * type with this module's export of that name
 * ([defined-hooks.md](../../../../doc/sasha-gil/ir/defined-hooks.md)).
 * The variants that know the IR heap import the Heap interface beside
 * `Ref`, and their hooks count a long string in it through the Heap; the
 * [host proof](./proof.mjs) runs them on both arenas.
 */

import { assert, assertEq, assertOk } from '../../../asserts/module.f.js'
import { functions, wat } from '../../../media/wasm/wat/module.f.js'
import { check, checkPlain } from '../../check/module.f.js'
import { l0, string } from '../../l0/module.f.js'
import { lifetime } from '../../lifetime/module.f.js'
import { definedBy, fn, lit } from '../../module.f.js'
import { print } from '../../print/module.f.js'
import { emit } from '../../wasm/module.f.js'
import { checked, checkedWithHeap, iface, module, withHeap } from './module.f.js'

/** @type {(m: import('../../types.ts').Module) => string} */
const emittedWat = m => wat(emit(assertOk(check(assertOk(lifetime(m))))))

/** The WAT of a module's function `name`, after the lifetime pass. @type {(m: import('../../types.ts').Module, name: string) => string} */
const watOf = (m, name) => {
    const owned = assertOk(check(assertOk(lifetime(m))))
    const k = owned.functions.findIndex(([f]) => f === name)
    return functions(emit(owned))[Number(k)]
}

/** The functions of each variant, in their order. */
const names = 'isRef,dup,drop,kind,to_f64,from_f64,to_bool,from_bool,same,keep,take,forget,undefinedOf,nullOf,falseOf,trueOf'

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
    // Forged bits trap as a misuse in every variant, so no function of any may fail, as the interface says of each.
    effect: () => {
        /** @type {(m: import('../../types.ts').Module) => string} */
        const failing = m => assertOk(checkPlain(m)).functions.flatMap(([k, { fails }]) => fails ? [k] : []).join()
        assertEq(failing(module), '')
        assertEq(failing(checked), '')
        assertEq(failing(withHeap), '')
        assertEq(failing(checkedWithHeap), '')
        assert(iface.functions.every(([, { fails }]) => fails !== true))
    },
    // The variants that know the IR heap import the Heap interface beside Ref, the checked one the debug arena's,
    // and define and export what the others do; the others import no Heap.
    heapShape: () => {
        assertEq(withHeap.imports.map(([k]) => k).join(), 'Ref,Heap')
        assertEq(checkedWithHeap.imports.map(([k]) => k).join(), 'Ref,Heap')
        assertEq(withHeap.imports[1][1].functions.map(([k]) => k).join(), 'alloc,dup,drop,free')
        assertEq(checkedWithHeap.imports[1][1].functions.map(([k]) => k).join(), 'alloc,dup,drop,free,live,type_of')
        assertEq(`${definedBy(withHeap)} ${definedBy(checkedWithHeap)}`, 'Any Any')
        assertEq(withHeap.exports.join(), module.exports.join())
        assertEq(checkedWithHeap.exports.join(), module.exports.join())
        assert(!emittedWat(module).includes('fjs:ir/heap'))
        assert(!emittedWat(checked).includes('fjs:ir/heap'))
    },
    // The plain stage and the owned stage type every function of the variants that know the IR heap too.
    heapChecked: () => {
        for (const m of [withHeap, checkedWithHeap]) {
            assertEq(assertOk(checkPlain(m)).functions.map(([k]) => k).join(), names)
            assertEq(assertOk(check(assertOk(lifetime(m)))).functions.map(([k]) => k).join(), names)
        }
    },
    // The hooks send a reference whose kind nibble is 9 to the Heap, with its block's address, and free its block
    // where the drop of its last owner answers that it may; every other reference counts through Ref as before.
    heapHooks: () => {
        const text = print(assertOk(lifetime(withHeap)))
        assert(text.includes([
            'fn dup(b: u(64)) -> u(64) =',
            '    if isRef(b)',
            '    then',
            '        if eq(and(b, 4222124650659840), 2533274790395904)',
            '        then',
            '            let counted = Heap.dup(and(b, 4294967288))',
            '            b',
            '        else',
            '            Ref.dup_ref(b)',
            '    else',
            '        b',
        ].join('\n')))
        assert(text.includes([
            'fn drop(b: u(64)) -> unit =',
            '    if isRef(b)',
            '    then',
            '        if eq(and(b, 4222124650659840), 2533274790395904)',
            '        then',
            '            let p = and(b, 4294967288)',
            '            if Heap.drop(p) then Heap.free(p) else {}',
            '        else',
            '            Ref.drop_ref(b)',
            '    else',
            '        {}',
        ].join('\n')))
        // the checked variant's hooks are the same, but for their indices among more imports
        for (const hook of ['dup', 'drop']) {
            assertEq(watOf(checkedWithHeap, hook).split('\n').slice(1).join('\n'), watOf(withHeap, hook).split('\n').slice(1).join('\n'))
        }
    },
    // The hooks' WebAssembly: one mask and one compare tell an IR string, and its block's address is a 32-bit word.
    heapDupWat: () => assertEq(watOf(withHeap, 'dup'), [
        "  (func $dup (;9;) (type 1) (param $b i64) (result i64)",
        "    local.get $b",
        "    call $isRef",
        "    if (result i64) ;; label = @1",
        "      local.get $b",
        "      i64.const 4222124650659840",
        "      i64.and",
        "      i64.const 2533274790395904",
        "      i64.eq",
        "      if (result i64) ;; label = @2",
        "        local.get $b",
        "        i64.const 4294967288",
        "        i64.and",
        "        i32.wrap_i64",
        "        call $Heap.dup",
        "        local.get $b",
        "      else",
        "        local.get $b",
        "        call $Ref.dup_ref",
        "      end",
        "    else",
        "      local.get $b",
        "    end",
        "  )",
        "",
    ].join('\n')),
    heapDropWat: () => assertEq(watOf(withHeap, 'drop'), [
        "  (func $drop (;10;) (type 2) (param $b i64)",
        "    (local $p i32)",
        "    local.get $b",
        "    call $isRef",
        "    if ;; label = @1",
        "      local.get $b",
        "      i64.const 4222124650659840",
        "      i64.and",
        "      i64.const 2533274790395904",
        "      i64.eq",
        "      if ;; label = @2",
        "        local.get $b",
        "        i64.const 4294967288",
        "        i64.and",
        "        i32.wrap_i64",
        "        local.set $p",
        "        local.get $p",
        "        call $Heap.drop",
        "        if ;; label = @3",
        "          local.get $p",
        "          call $Heap.free",
        "        else",
        "        end",
        "      else",
        "        local.get $b",
        "        call $Ref.drop_ref",
        "      end",
        "    else",
        "    end",
        "  )",
        "",
    ].join('\n')),
    // The plain variant reads nibble 9 as a string's, with no call; the checked one asks the debug arena's
    // `type_of` for it, and NaNVM's `kind_ref` for every other reference.
    heapKind: () => {
        const plain = emittedWat(withHeap)
        const debug = emittedWat(checkedWithHeap)
        assert(!plain.includes('call $Ref.kind_ref') && !plain.includes('call $Heap.type_of'))
        assert(debug.includes('call $Ref.kind_ref') && debug.includes('call $Heap.type_of'))
        assert(print(assertOk(lifetime(withHeap))).includes("if eq(t, 8) then 8 else if eq(t, 9) then 4 else misuse('not a value')"))
        assert(print(assertOk(lifetime(module))).includes("if eq(t, 8) then 8 else misuse('not a value')"))
    },
}
