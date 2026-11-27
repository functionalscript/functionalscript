/**
 * Proofs of the Heap module's arenas: each imports L0's `Memory` alone,
 * its exports are the Heap interface's functions with their signatures,
 * and in debug those of the debug interface, `live` and `type_of`, none
 * may fail, since running out of memory and
 * every misuse trap as a misuse, the fast path of the release `alloc` is a
 * bump of the pointer, and the debug `dup` checks the address and the count
 * before it adds 1. The [host proof](./proof.mjs) runs both against the
 * [model](./model/module.f.js).
 *
 * @import { Module } from '../../types.ts'
 */

import { assertEq, assertNotNullish, assertOk } from '../../../asserts/module.f.js'
import { functions } from '../../../media/wasm/wat/module.f.js'
import { check } from '../../check/module.f.js'
import { equal, u } from '../../module.f.js'
import { emit } from '../../wasm/module.f.js'
import { counted, debugIface, iface, module } from './module.f.js'

/** The interface's functions by name. */
const names = iface.functions.map(([k]) => k)

/** The debug interface's functions by name. */
const debugNames = debugIface.functions.map(([k]) => k)

/** The WAT of a module's function `name`. @type {(m: Module, name: string) => string} */
const wat = (m, name) => {
    const checked = assertOk(check(m))
    const k = checked.functions.findIndex(([f]) => f === name)
    return functions(emit(checked))[Number(k)]
}

export const proof = {
    // Each arena imports Memory alone, keeps its state in one constant, and exports the interface's functions, and
    // debug those of the debug interface, which are the interface's, `live` and `type_of`.
    shape: () => {
        for (const m of [module, counted]) {
            assertEq(m.imports.map(([k]) => k).join(), 'Memory')
            assertEq(m.constants?.map(([k]) => k).join(), 'state')
        }
        assertEq(module.exports.join(), names.join())
        assertEq(counted.exports.join(), debugNames.join())
        assertEq(debugNames.join(), [...names, 'live', 'type_of'].join())
        assertEq(debugIface.abi, iface.abi)
    },
    // Each export has the signature that its interface gives it: `live` takes nothing and answers a `u(32)`, and
    // `type_of` takes an address and answers a type.
    signatures: () => {
        for (const [m, face] of /** @type {const} */ ([[module, iface], [counted, debugIface]])) {
            for (const [name, { params, result }] of face.functions) {
                const [, f] = assertNotNullish(m.functions.find(([k]) => k === name))
                assertEq(equal(f.params, params) && equal(f.result, result), true)
            }
        }
        const [, live] = assertNotNullish(debugIface.functions.find(([k]) => k === 'live'))
        assertEq(live.params.length === 0 && equal(live.result, u(32)), true)
        const [, typeOf] = assertNotNullish(debugIface.functions.find(([k]) => k === 'type_of'))
        assertEq(typeOf.params.length === 1 && equal(typeOf.params[0][1], u(32)) && equal(typeOf.result, u(8)), true)
    },
    // Running out of memory, a free in release and every misuse in debug trap as a misuse, so no function may fail.
    effect: () => {
        /** @type {(m: Module) => string} */
        const fails = m => assertOk(check(m)).functions.map(([k, { fails }]) => `${k}: ${fails}`).join(', ')
        assertEq(fails(module), 'alloc: false, grown: false, taken: false, dup: false, drop: false, free: false')
        assertEq(fails(counted), 'alloc: false, grown: false, taken: false, dup: false, drop: false, free: false, live: false, type_of: false')
    },
    // The release fast path loads the pointer, moves it past the rounded size where the region holds it, and answers
    // where it was.
    fastPath: () => assertEq(wat(module, 'alloc'), [
        "  (func $alloc (;0;) (type 0) (param $t i32) (param $n i32) (result i32)",
        "    (local $size i32) (local $top i32) (local $next i64)",
        "    local.get $n",
        "    i32.const 7",
        "    i32.add",
        "    i32.const -8",
        "    i32.and",
        "    local.set $size",
        "    global.get $state",
        "    i32.load",
        "    local.set $top",
        "    local.get $top",
        "    i64.extend_i32_u",
        "    local.get $size",
        "    i64.extend_i32_u",
        "    i64.add",
        "    local.set $next",
        "    local.get $next",
        "    global.get $state",
        "    i32.const 4",
        "    i32.add",
        "    i32.load",
        "    i64.extend_i32_u",
        "    i64.le_u",
        "    if (result i32) ;; label = @1",
        "      global.get $state",
        "      local.get $next",
        "      i32.wrap_i64",
        "      i32.store",
        "      local.get $top",
        "    else",
        "      local.get $t",
        "      local.get $n",
        "      call $grown",
        "    end",
        "  )",
        "",
    ].join('\n')),
    // The debug `dup` refuses an address that no block has and a count of 0 or one that cannot grow, then adds 1.
    countedDup: () => assertEq(wat(counted, 'dup'), [
        "  (func $dup (;3;) (type 2) (param $p i32)",
        "    (local $header i32) (local $count i32)",
        "    local.get $p",
        "    i32.const 7",
        "    i32.and",
        "    i32.const 0",
        "    i32.eq",
        "    if ;; label = @1",
        "      local.get $p",
        "      global.get $state",
        "      i32.const 32",
        "      i32.add",
        "      i32.lt_u",
        "      if ;; label = @2",
        "        unreachable",
        "      else",
        "        global.get $state",
        "        i32.load",
        "        local.get $p",
        "        i32.lt_u",
        "        if ;; label = @3",
        "          unreachable",
        "        else",
        "          local.get $p",
        "          i32.const 8",
        "          i32.sub",
        "          local.set $header",
        "          local.get $header",
        "          i32.load",
        "          local.set $count",
        "          local.get $count",
        "          i32.const 0",
        "          i32.eq",
        "          if ;; label = @4",
        "            unreachable",
        "          else",
        "            local.get $count",
        "            i32.const -1",
        "            i32.eq",
        "            if ;; label = @5",
        "              unreachable",
        "            else",
        "              local.get $header",
        "              local.get $count",
        "              i32.const 1",
        "              i32.add",
        "              i32.store",
        "            end",
        "          end",
        "        end",
        "      end",
        "    else",
        "      unreachable",
        "    end",
        "  )",
        "",
    ].join('\n')),
}
