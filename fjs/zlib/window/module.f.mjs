/**
 * The window of an inflater: what a stream has produced, of which a
 * back-reference reads any of the last 32 KiB. DEFLATE appends a byte at a
 * time and reads at an offset behind the end, and a persistent array can do
 * neither cheaply, so the window is two parts. The last few bytes are a list,
 * newest first, which is appended to in constant time; when it holds a block it
 * is frozen into an array, and the full blocks are an array of arrays that is
 * indexed in constant time. A read behind the list is an index into the blocks;
 * one inside it walks it, which is why a copy at a distance shorter than a
 * block takes the bytes once and repeats them.
 *
 * The design and its measurement are in
 * [`todo/inflate.md`](../../../todo/inflate.md).
 *
 * @module
 *
 * @import { Window } from './types.ts'
 */

import { reverse, take } from '../../types/list/module.f.js'
import { toArray } from '../../types/list/alt/module.f.js'
import { min } from '../../types/number/min/module.f.js'
import { generate } from '../../types/array/generate/module.f.js'

/** How many bytes a block holds. */
const blockLength = 256

/** The blocks to keep: 32 KiB, which no distance reaches past. */
const blocksKept = 128

/** @type {Window} */
export const empty = { blocks: [], tail: null, tailLength: 0, length: 0 }

/**
 * The window after `byte`.
 *
 * @type {(window: Window, byte: number) => Window}
 */
export const push = ({ blocks, tail, tailLength, length }, byte) => {
    const next = { first: byte, tail }
    return tailLength + 1 < blockLength
        ? { blocks, tail: next, tailLength: tailLength + 1, length: length + 1 }
        : {
            blocks: [...blocks.length < blocksKept ? blocks : blocks.slice(1), toArray(reverse(next))],
            tail: null,
            tailLength: 0,
            length: length + 1,
        }
}

/**
 * The window after `bytes`, in order.
 *
 * @type {(window: Window, bytes: readonly number[]) => Window}
 */
export const pushAll = (window, bytes) => bytes.reduce(push, window)

/**
 * The last `n` bytes, the oldest first, `n` at most what the window holds.
 *
 * @type {(window: Window, n: number) => readonly number[]}
 */
export const last = ({ blocks, tail, tailLength }, n) => {
    const inTail = min(n, tailLength)
    // the tail is newest first
    const newest = toArray(take(inTail)(tail))
    const fromTail = generate(inTail, i => newest[inTail - 1 - i])
    const rest = n - inTail
    return rest > 0
        ? [...blocks.slice(-Math.ceil(rest / blockLength)).flat().slice(-rest), ...fromTail]
        : fromTail
}

/**
 * The byte `distance` back, 1 for the last, where `distance` is at least a
 * block and at most what the window holds and 32 768: behind the tail, in the
 * blocks, whose end is where the tail begins.
 *
 * @type {(window: Window, distance: number) => number}
 */
const fromBlocks = ({ blocks, tailLength }, distance) => {
    const at = blocks.length * blockLength - (distance - tailLength)
    return blocks[at >> 8][at & blockLength - 1]
}

/**
 * The window after a copy of `length` bytes from `distance` back, as DEFLATE
 * says it: a `distance` shorter than `length` repeats what the copy has
 * written, so `length` 5 at `distance` 1 repeats the last byte five times.
 *
 * @type {(window: Window, distance: number, length: number) => Window}
 */
export const copy = (window, distance, length) => {
    if (distance < blockLength) {
        // what is repeated is the last `distance` bytes, all there is to read
        const pattern = last(window, distance)
        return pushAll(window, generate(length, i => pattern[i % distance]))
    }
    // a distance of a block or more is always behind the tail, whatever the
    // copy writes, so every byte is an index into the blocks
    let result = window
    for (let i = 0; i < length; i += 1) { result = push(result, fromBlocks(result, distance)) }
    return result
}
