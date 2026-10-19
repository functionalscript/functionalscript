/** @import { Window } from './types.ts' */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { copy, empty, last, push, pushAll } from './module.f.mjs'

/** @type {(bytes: number) => readonly number[]} */
const varied = bytes => Array.from({ length: bytes }, (_, i) => i * 37 + 11 & 0xff)

/**
 * The window agrees with the plain array it stands for, the obvious thing it is
 * to match after any run of operations.
 *
 * @type {(window: Window, model: readonly number[]) => void}
 */
const agree = (window, model) => {
    assertEq(window.length, model.length)
    // the last of it, from nothing to all that is kept
    for (const n of [0, 1, 2, 255, 256, 257, 511, 512, 1000, 32_768]) {
        if (n <= model.length && n <= 32_768) { assertStructurallySame(last(window, n), model.slice(model.length - n), n) }
    }
}

export const proof = {
    empty: () => {
        assertEq(empty.length, 0)
        assertStructurallySame(last(empty, 0), [])
    },
    // A byte at a time, over the edge where the list becomes a block.
    push: () => {
        let window = empty
        let model = /** @type {readonly number[]} */ ([])
        for (const byte of varied(1000)) {
            window = push(window, byte)
            model = [...model, byte]
            agree(window, model)
        }
    },
    pushAll: () => {
        assertStructurallySame(last(pushAll(empty, [1, 2, 3]), 3), [1, 2, 3])
        assertStructurallySame(last(pushAll(empty, []), 0), [])
    },
    // Past 32 KiB the oldest block goes, and what is read back is the same.
    forgets: () => {
        const bytes = varied(40_000)
        const window = pushAll(empty, bytes)
        assertEq(window.blocks.length, 128)
        agree(window, bytes)
        assertStructurallySame(last(window, 32_768), bytes.slice(40_000 - 32_768))
    },
    // A copy from a distance shorter than a block takes the bytes once and
    // repeats them: one byte over and over, a pair, and a pattern longer than
    // the copy.
    nearCopy: () => {
        const bytes = varied(300)
        for (const [distance, length] of [[1, 5], [2, 7], [3, 258], [255, 258], [10, 4]]) {
            const model = [...bytes, ...Array.from({ length }, (_, i) => bytes[bytes.length - distance + i % distance])]
            agree(copy(pushAll(empty, bytes), distance, length), model)
        }
    },
    // A copy from a block or more behind reads the blocks, and a distance of
    // exactly one block overlaps the bytes the copy has written.
    farCopy: () => {
        const bytes = varied(40_000)
        for (const [distance, length] of [[256, 258], [257, 3], [1000, 258], [32_768, 258], [300, 3]]) {
            const model = Array.from({ length }).reduce(so => [...so, so[so.length - distance]], bytes)
            agree(copy(pushAll(empty, bytes), distance, length), model)
        }
    },
}
