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
 * @import { Marked, Run, Span } from './types.ts'
 */

import { error, ok } from '../../types/result/module.f.mjs'

/**
 * The text the runs spell.
 *
 * @type {(marked: Marked) => string}
 */
export const toText = marked => marked.map(([text]) => text).join('')

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
