/**
 * A zlib stream read for Git: [`fjs/zlib/inflate`](../../zlib/inflate/module.f.mjs)
 * fed the chunks a read gives, and what comes of it as the refusals the host's
 * `inflate` effect gave, so a caller that tells them apart by code is not told
 * anything new. The inflater is pure; this is the seam between it and the
 * effects that read the bytes, and nothing more.
 *
 * The host's `inflate` answered one `Vec` of at most 128 KiB for one `Vec` of
 * at most 128 KiB. This reads a stream of any length in any number of chunks and
 * answers any number of chunks, so a loose object or a pack entry is no longer
 * refused for its size. See [`todo/inflate.md`](../../../todo/inflate.md).
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Bytes } from '../types.ts'
 * @import { Progress, Refusal } from './types.ts'
 */

import { inflateTrailingCode, inflateTrailingMessage } from '../../effects/node/module.f.mjs'
import { bytesIn, length, u8ListMsb, u8ListToVecMsb, u8ArrayMsb } from '../../types/bit_vec/module.f.mjs'
import { flat, map, reverse } from '../../types/list/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { inflate } from '../../zlib/inflate/module.f.mjs'

/** A stream not yet read. @type {Progress} */
export const start = { state: inflate.init[2], made: null, size: 0 }

/**
 * The stream after a chunk of it, or `null` where the chunk makes it malformed.
 *
 * @type {(chunk: Vec) => (progress: Progress) => Nullable<Progress>}
 */
export const feed = chunk => ({ state, made, size }) => {
    const [kind, output, next] = inflate.update(state, chunk)
    return kind === 'done'
        ? null
        : {
            state: next,
            made: output.reduce((so, v) => ({ first: v, tail: so }), made),
            size: output.reduce((so, v) => so + Number(bytesIn(length(v))), size)
        }
}

/**
 * How much input is inflated before the output is looked at. A DEFLATE stream
 * makes up to a thousand bytes of output from one of input, so a chunk of a
 * `Vec`'s size could make a hundred megabytes before anything could say it is
 * enough; a piece makes a megabyte at most.
 */
const pieceBytes = 0x400

/**
 * The pieces of a chunk, each of up to {@link pieceBytes}.
 *
 * @type {(chunk: Vec) => readonly Vec[]}
 */
const piecesOf = chunk => {
    const bytes = u8ArrayMsb(chunk)
    return Array.from(
        { length: Math.ceil(bytes.length / pieceBytes) },
        (_, i) => u8ListToVecMsb(bytes.slice(i * pieceBytes, (i + 1) * pieceBytes)))
}

/**
 * The stream after a chunk of it, fed a piece at a time and not read on once its
 * output is over `limit`: it is `null` where the chunk makes it malformed, and
 * otherwise has at most a piece's worth of output beyond `limit`, and the rest of
 * the chunk is not inflated. A caller that goes on past the limit takes the
 * chunk's rest from itself.
 *
 * @type {(limit: number) => (chunk: Vec) => (progress: Progress) => Nullable<Progress>}
 */
export const feedWithin = limit => chunk => progress => {
    let current = progress
    for (const piece of piecesOf(chunk)) {
        if (current.size > limit) { return current }
        const next = feed(piece)(current)
        if (next === null) { return null }
        current = next
    }
    return current
}

/** The refusal of a stream that is malformed: `Z_DATA_ERROR`, as zlib calls it. @type {Refusal} */
export const malformed = { code: 'Z_DATA_ERROR', message: 'invalid zlib stream' }

/** The refusal of a stream that ends before it closes: `Z_BUF_ERROR`, as zlib calls it. @type {Refusal} */
const truncated = { code: 'Z_BUF_ERROR', message: 'unexpected end of file' }

/**
 * What the stream gave, once all of it has been read: its output, oldest chunk
 * first, or the reason it is no stream held whole. A stream that has not closed
 * is truncated, and bytes after one are refused, as the host's `inflate` did:
 * a file that holds them is not the object its stream spells.
 *
 * @type {(progress: Progress) => Result<List<Vec>, Refusal>}
 */
export const finish = ({ state, made }) => {
    const [, , after] = inflate.end(state)
    if (after === null) { return error(truncated) }
    return after === 0
        ? ok(reverse(made))
        : error({ code: inflateTrailingCode, message: inflateTrailingMessage(after) })
}

/**
 * The stream held whole as chunks, inflated: its output, or the reason not.
 *
 * @type {(chunks: readonly Vec[]) => Result<List<Vec>, Refusal>}
 */
export const inflateAll = chunks => {
    const progress = chunks.reduce(
        /** @type {(so: Nullable<Progress>, chunk: Vec) => Nullable<Progress>} */
        (so, chunk) => so === null ? null : feed(chunk)(so),
        start)
    return progress === null ? error(malformed) : finish(progress)
}

/**
 * The stream held whole as chunks, inflated as long as its output is within
 * what `limitOf` allows. `limitOf` is asked once, when the output first holds
 * `head` bytes, with those bytes (all of the output, if the stream ends sooner
 * and the answer is not needed): the most the stream may inflate to, or `null`
 * where the bytes show it is no stream worth reading. Output past the limit, or
 * a `null`, stops the read at that chunk with `null`, and not a byte of the rest
 * is inflated, so a small stream cannot be made to inflate to gigabytes before
 * what it declares is looked at.
 *
 * @type {(head: number, limitOf: (output: Bytes) => Nullable<number>) => (chunks: readonly Vec[]) => Result<Nullable<List<Vec>>, Refusal>}
 */
export const inflateWithin = (head, limitOf) => chunks => {
    let progress = start
    /** @type {Nullable<number>} */
    let limit = null
    for (const chunk of chunks) {
        for (const piece of piecesOf(chunk)) {
            const next = feed(piece)(progress)
            if (next === null) { return error(malformed) }
            if (limit === null && next.size >= head) {
                limit = limitOf(bytesOf(reverse(next.made)))
                if (limit === null) { return ok(null) }
            }
            if (limit !== null && next.size > limit) { return ok(null) }
            progress = next
        }
    }
    return finish(progress)
}

/**
 * The bytes of output chunks, as the list of numbers the rest of Git's readers
 * take: lazy, so nothing is copied, and as long as the output is.
 *
 * @type {(output: List<Vec>) => Bytes}
 */
export const bytesOf = output => flat(map(u8ListMsb)(output))

/**
 * How many bytes the output chunks hold.
 *
 * @type {(output: List<Vec>) => number}
 */
export const sizeOf = output => toArray(output).reduce((total, v) => total + Number(bytesIn(length(v))), 0)
