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
 * @import { Chunk, Marked, Run, Span, TokenKind } from './types.ts'
 */

import { map, toArray } from '../../types/list/module.f.mjs'
import { assert } from '../../asserts/module.f.mjs'
import { error, ok, unwrap } from '../../types/result/module.f.mjs'

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

// -- tagged text ---------------------------------------------------------------

/** What a kind is written as inside tagged text. @type {{ readonly [k in TokenKind]: string }} */
const kindCodes = { keyword: 'k', literal: 'l', string: 's', number: 'n', comment: 'c', operator: 'o' }

const open = '\u0001'

const close = '\u0002'

/**
 * A text that a producer composes as a string and resolves into runs at its
 * boundary: a run is `U+0001`, one letter for its kind, its text and
 * `U+0002`. It is the idiom `fjs/compiler/serializer/names` uses for symbolic
 * names, for a producer whose text is built by templates all through; the
 * public text a producer answers is never tagged, only its marked text is
 * resolved from it, and {@link untagged} gives the plain one.
 *
 * A tag does not nest, and the text inside one may hold neither marker: a
 * producer escapes the data it prints, and these two control characters are
 * escaped by every language it prints, so no data can forge a tag.
 *
 * @type {(kind: TokenKind) => (text: string) => string}
 */
export const tagged = kind => text => {
    assert(!text.includes(open) && !text.includes(close), ['a tagged text holding a marker', text])
    return `${open}${kindCodes[kind]}${text}${close}`
}

/** Kinds by their letter. @type {ReadonlyMap<string, TokenKind>} */
const kindsByCode = new Map(/** @type {readonly [string, TokenKind][]} */ (Object.entries(kindCodes).map(([kind, code]) => [code, kind])))

/**
 * The runs of a tagged text, or why it is not one: a tag left open, a kind
 * no letter names, or a closing marker with no opening. Refused, never
 * repaired ([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
 *
 * @type {(text: string) => Result<Marked, string>}
 */
export const fromTagged = text => {
    const [head, ...rest] = text.split(open)
    if (head.includes(close)) { return error('a closing marker with no opening') }
    /** @type {(acc: Result<Marked, string>, part: string) => Result<Marked, string>} */
    const step = (acc, part) => {
        if (acc[0] === 'error') { return acc }
        const kind = kindsByCode.get(part.slice(0, 1))
        if (kind === undefined) { return error(`a tag of no kind: ${part.slice(0, 1)}`) }
        const [inside, ...after] = part.slice(1).split(close)
        if (after.length !== 1) { return error(after.length === 0 ? 'a tag left open' : 'a closing marker with no opening') }
        return ok([...acc[1], [inside, kind], ...(after[0] === '' ? [] : [/** @type {Run} */ ([after[0]])])])
    }
    return rest.reduce(step, /** @type {Result<Marked, string>} */(ok(head === '' ? [] : [[head]])))
}

/**
 * The plain text of a tagged text, the markers gone. A malformed one is
 * refused by the assert, as a printer that made it has a defect.
 *
 * @type {(text: string) => string}
 */
export const untagged = text => toText(unwrap(fromTagged(text)))

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
