/**
 * Marked text: a text written as runs, each with the kind its producer knew
 * it to be. Highlighting is a layer apart from the text, as in LSP semantic
 * tokens, Pygments and Tree-sitter: the runs' texts, concatenated, are the
 * text, so what a producer writes to a file is {@link toText} of its runs.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Chunk, Marked, Run, Span } from './types.ts'
 */

import { map, toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'

/**
 * The text the runs spell.
 *
 * @type {(marked: Marked) => string}
 */
export const toText = marked => marked.map(([text]) => text).join('')

/**
 * A keyword: `const`, `export`, `typeof`, …
 *
 * @type {(word: string) => Run}
 */
export const keyword = word => [word, 'keyword']

/**
 * A literal word: `undefined`, `null`, `true`, `false`.
 *
 * @type {(word: string) => Run}
 */
export const literal = word => [word, 'literal']

/**
 * The text of a chunk.
 *
 * @type {(chunk: Chunk) => string}
 */
export const chunkText = chunk => typeof chunk === 'string' ? chunk : chunk[0]

/**
 * A chunk as a run: a bare string is an unmarked one.
 *
 * @type {(chunk: Chunk) => Run}
 */
export const chunkRun = chunk => typeof chunk === 'string' ? [chunk] : chunk

/**
 * The runs a list of chunks spells.
 *
 * @type {(chunks: List<Chunk>) => Marked}
 */
export const chunksMarked = chunks => toArray(chunks).map(chunkRun)

/**
 * The chunks as plain strings, the markup dropped: what a writer's public
 * `List<string>` API still answers.
 *
 * @type {(chunks: List<Chunk>) => List<string>}
 */
export const chunkStrings = map(chunkText)

/**
 * The text a list of chunks spells.
 *
 * @type {(chunks: List<Chunk>) => string}
 */
export const chunksText = chunks => toArray(chunks).map(chunkText).join('')

/**
 * A text with spans beside it, as runs: the spans' text with their kind, the
 * gaps between them plain. Spans are in order and do not overlap, as LSP
 * semantic tokens are unless a client opts in; a span that is empty, out of
 * the text, overlapping or out of order is refused, not clamped.
 *
 * @type {(text: string) => (spans: readonly Span[]) => Result<Marked, string>}
 */
export const fromSpans = text => spans => {
    const symbols = Array.from(text)
    /** @type {(from: number, to: number) => readonly Run[]} */
    const plain = (from, to) => from < to ? [[symbols.slice(from, to).join('')]] : []
    /** @type {(acc: Result<readonly [number, Marked], string>, span: Span) => Result<readonly [number, Marked], string>} */
    const step = (acc, { start, length, kind }) => {
        if (acc[0] === 'error') { return acc }
        const [position, runs] = acc[1]
        if (!Number.isInteger(start) || !Number.isInteger(length) || length < 1) {
            return error(`span ${start}+${length} is not a non-empty range of whole code points`)
        }
        if (start < position) { return error(`span ${start}+${length} overlaps or precedes the text before it`) }
        const end = start + length
        if (end > symbols.length) { return error(`span ${start}+${length} is past the end of the text (${symbols.length})`) }
        return ok([end, [...runs, ...plain(position, start), [symbols.slice(start, end).join(''), kind]]])
    }
    const result = spans.reduce(step, /** @type {Result<readonly [number, Marked], string>} */(ok([0, []])))
    return result[0] === 'error' ? result : ok([...result[1][1], ...plain(result[1][0], symbols.length)])
}
