/**
 * Proofs of the Heap module's release arena: it imports L0's `Memory`
 * alone, its exports are the Heap interface's functions with their
 * signatures, none may fail, since running out of memory and a `free` are
 * misuse, and the fast path of `alloc` is a bump of the pointer. The
 * [host proof](./proof.mjs) runs it against the [model](./model/module.f.js).
 */

import { assertEq, assertNotNullish, assertOk } from '../../../asserts/module.f.js'
import { functions } from '../../../media/wasm/wat/module.f.js'
import { check } from '../../check/module.f.js'
import { equal } from '../../module.f.js'
import { emit } from '../../wasm/module.f.js'
import { iface, module } from './module.f.js'

export const proof = {
    // The module imports Memory alone, keeps its state in one constant, and exports the interface's functions.
    shape: () => {
        assertEq(module.imports.map(([k]) => k).join(), 'Memory')
        assertEq(module.constants?.map(([k]) => k).join(), 'state')
        assertEq(module.exports.join(), iface.functions.map(([k]) => k).join())
    },
    // Each export has the signature that the interface gives it.
    signatures: () => {
        for (const [name, { params, result }] of iface.functions) {
            const [, f] = assertNotNullish(module.functions.find(([k]) => k === name))
            assertEq(equal(f.params, params) && equal(f.result, result), true)
        }
    },
    // Running out of memory and a free in release are misuse, so no function may fail.
    effect: () => {
        assertEq(assertOk(check(module)).functions.map(([k, { fails }]) => `${k}: ${fails}`).join(', '),
            'alloc: false, grown: false, taken: false, dup: false, drop: false, free: false')
    },
    // The fast path loads the pointer, moves it past the rounded size where the region holds it, and answers where it was.
    fastPath: () => assertEq(functions(emit(assertOk(check(module))))[0], [
        "  (func $alloc (;0;) (type 0) (param $t i32) (param $n i32) (result i32)",
        "    (local $size i32) (local $top i32) (local $next i64) (local $end i32) (local $over i64)",
        "    local.get $n",
        "    i32.const 0",
        "    i32.eq",
        "    if (result i32) ;; label = @1",
        "      i32.const 8",
        "    else",
        "      local.get $n",
        "      i32.const 7",
        "      i32.add",
        "      i32.const -8",
        "      i32.and",
        "    end",
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
        "    global.get $state",
        "    i32.const 4",
        "    i32.add",
        "    i32.load",
        "    local.set $end",
        "    local.get $next",
        "    local.get $end",
        "    i64.extend_i32_u",
        "    i64.le_u",
        "    if (result i32) ;; label = @1",
        "      global.get $state",
        "      local.get $next",
        "      i32.wrap_i64",
        "      i32.store",
        "      local.get $top",
        "    else",
        "      local.get $next",
        "      local.get $end",
        "      i64.extend_i32_u",
        "      i64.sub",
        "      local.set $over",
        "      i64.const 0",
        "      local.get $over",
        "      i64.lt_s",
        "      if (result i32) ;; label = @2",
        "        local.get $over",
        "        local.get $size",
        "        i64.extend_i32_u",
        "        i64.le_u",
        "        if (result i32) ;; label = @3",
        "          local.get $t",
        "          local.get $size",
        "          local.get $over",
        "          i32.wrap_i64",
        "          local.get $end",
        "          call $grown",
        "        else",
        "          unreachable",
        "        end",
        "      else",
        "        unreachable",
        "      end",
        "    end",
        "  )",
        "",
    ].join('\n')),
}
