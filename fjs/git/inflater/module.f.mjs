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
import { bytesIn, length, u8ListMsb } from '../../types/bit_vec/module.f.mjs'
import { flat, map, reverse, toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { append, end, init } from '../../zlib/inflate/module.f.mjs'

/** A stream not yet read. @type {Progress} */
export const start = { state: init, made: null }

/**
 * The stream after a chunk of it, or `null` where the chunk makes it malformed.
 *
 * @type {(chunk: Vec) => (progress: Progress) => Nullable<Progress>}
 */
export const feed = chunk => ({ state, made }) => {
    const result = append(chunk)(state)
    return result === null
        ? null
        : { state: result.state, made: result.output.reduce((so, v) => ({ first: v, tail: so }), made) }
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
    const after = end(state)
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
