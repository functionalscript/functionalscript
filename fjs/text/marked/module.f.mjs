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
 * A literal word: `undefined`, `null`, `true`, `false`, `NaN`, `Infinity`.
 *
 * @type {(word: string) => Run}
 */
export const literal = word => [word, 'literal']

/**
 * A text with nothing marked: the output of a producer that has no kinds to
 * give, such as the Rust printer for now.
 *
 * @type {(text: string) => Marked}
 */
export const unmarked = text => [[text]]

/**
 * The text of a result: the text of the marked text an `ok` holds, or the
 * message an `error` holds. What a page shows in either case, and what a proof
 * compares it with.
 *
 * @type {(result: Result<Marked, string>) => string}
 */
export const textOfResult = result => result[0] === 'ok' ? toText(result[1]) : result[1]

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
    /** @type {(i: number) => number} */
    const endBefore = i => i === 0 ? 0 : spans[i - 1].start + spans[i - 1].length
    /** @type {(span: Span, i: number) => string | null} */
    const problem = ({ start, length }, i) => {
        if (!Number.isInteger(start) || !Number.isInteger(length) || length < 1) {
            return `span ${start}+${length} is not a non-empty range of whole code points`
        }
        if (start < endBefore(i)) { return `span ${start}+${length} overlaps or precedes the text before it` }
        if (start + length > symbols.length) { return `span ${start}+${length} is past the end of the text (${symbols.length})` }
        return null
    }
    const failed = spans.map(problem).find(message => message !== null)
    if (failed !== undefined) { return error(failed) }
    const last = endBefore(spans.length)
    return ok([
        ...spans.flatMap((span, i) => [...plain(endBefore(i), span.start), /** @type {Run} */ ([symbols.slice(span.start, span.start + span.length).join(''), span.kind])]),
        ...plain(last, symbols.length),
    ])
}
