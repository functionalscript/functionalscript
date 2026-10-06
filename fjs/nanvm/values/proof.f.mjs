/**
 * The native fixture starts from a computed value, preserving slot positions
 * and sharing. `nanvm-harness` compiles and invokes its generated Rust module.
 * @import { Array as ValueArray, Function as ValueFunction, Object as ValueObject } from '../../edag/value/types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { invoke } from '../../edag/memo/module.f.mjs'
import { directory, generate, path, value } from './module.f.mjs'

export const proof = {
    captures: () => {
        const [, properties] = /** @type {ValueObject} */ (value())
        assertStructurallySame(properties.map(([, key]) => key),
            ['shared', 'alias', 'call', 'again', 'other'])
        const [shared, alias, call, again, other] = properties.map(([, , v]) => v)
        assertEq(shared, alias)
        assertEq(call, again)
        assert(call !== other)
        assertStructurallySame(call, other)
        const [, length, slots, body] = /** @type {ValueFunction} */ (call)
        const [, , otherSlots, otherBody] = /** @type {ValueFunction} */ (other)
        assertEq(length, 1)
        assertStructurallySame(slots, [
            2, ['[]', [3]], ['[]', [3]], ['{}', [[':', 'unused', 9]]],
        ])
        assertEq(slots[1], shared)
        assertEq(slots[2], shared)
        slots.forEach((slot, i) => assertEq(slot, otherSlots[i]))
        assert(body !== otherBody)
    },
    invocation: () => {
        const [, properties] = /** @type {ValueObject} */ (value())
        const shared = properties[0][2]
        const call = /** @type {ValueFunction} */ (properties[2][2])
        const first = assertOk(invoke(call, [3], ['[]', []]))
        const second = assertOk(invoke(call, [3], ['[]', []]))
        assert(first !== second)
        for (const result of [first, second]) {
            assertStructurallySame(result, ['[]', [5, shared, shared]])
            const [, items] = /** @type {ValueArray} */ (result)
            assertEq(items[1], shared)
            assertEq(items[2], shared)
        }
    },
    generate: () => {
        assertEq(directory, 'nanvm-harness/gen.values')
        assertEq(path, 'nanvm-harness/gen.values/captures.rs')
        const rust = generate()
        assert(rust.startsWith('// Fixture source: `fjs/nanvm/values/module.f.mjs`; regenerate with `npm run gen`.'))
        assert(rust.includes('pub fn module<A: IStaticFunction>() -> Result<Any<A>, Any<A>>'))
    },
}
