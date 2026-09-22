/**
 * A changelog entry's Markdown, as the spans it denotes.
 *
 * The grammar is [`fjs/ebnf/lib/markdown`](../../ebnf/lib/markdown/module.f.mjs)
 * and the subset it recognises is described there. This module is its two
 * halves of processing: the block layer that decides what one entry's text
 * is, which runs **before** the grammar, and the fold from a match to
 * {@link Inline} spans, which runs after.
 *
 * **The block layer cannot be grammar work.** A release file is a list of
 * `- ` items whose wrapped lines are indented by two spaces, and a code span
 * may open on one line and close on the next — twenty lines in the tree
 * carry an odd number of backticks for that reason. So the lines are joined
 * first, with a single space where the source had a break, and the grammar
 * reads whole entries. A reader that fed it lines would split those spans
 * with no way to rejoin them.
 *
 * **A reference is not resolved here.** A bare `(#1807)` stays inside a
 * `text` span: deriving its link needs a repository the parser has no
 * business knowing, and leaving it as text is what lets the grammar avoid
 * telling a reference from parenthesised prose.
 *
 * @module
 *
 * @import { Ast, Meta } from '../../ebnf/ast/types.ts'
 * @import { Utf16 } from '../../ebnf/utf16/types.ts'
 * @import { RewriteSet } from '../../ebnf/ll1/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Document, Entry, Inline } from './types.ts'
 */

import { symbolAt, unmapped } from '../../ebnf/ast/module.f.mjs'
import { entry as entryRule } from '../../ebnf/lib/markdown/module.f.mjs'
import { eof } from '../../ebnf/module.f.mjs'
import { parser } from '../../ebnf/ll1/module.f.mjs'
import { units } from '../../ebnf/utf16/module.f.mjs'
import { listToString } from '../../text/utf16/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'

/**
 * The input units under a node, in order.
 *
 * **No case for a variant's tag**, which JSON's own reader has and this does
 * not need: every call below indexes past a tag before asking for the text
 * under what it found, so a tag never reaches here. Carrying the case anyway
 * would be a branch nothing can take, and a reader would have to work out
 * which of the two this module was.
 *
 * @type {(node: unknown) => readonly number[]}
 */
const unitsUnder = node =>
    node instanceof Array
        ? node.flatMap(unitsUnder)
        : [symbolAt(/** @type {Meta<Utf16>} */(node)).symbol]

/** The text a node spells. @type {(node: unknown) => string} */
const lexeme = node => listToString(unitsUnder(node))

/** @type {RewriteSet<Utf16, never>} */
const nothing = []

/**
 * One whole entry. `eof` is what makes a refusal a refusal: without it a
 * prefix matches and the rest of the entry is dropped in silence.
 */
const parseEntry = parser([entryRule, eof], nothing)

/** @type {(node: unknown) => readonly unknown[]} */
const arr = node => unmapped(/** @type {readonly unknown[]} */(node))

/**
 * One delimited span, by the branch the grammar took. Each case indexes the
 * rule's own tuple: `code` is the body between its backticks, `strong` the
 * body after the two asterisks it opens with, `em` the body before the one
 * it closes with, and a `link` its text and its target.
 *
 * @type {(node: unknown) => Inline}
 */
const spanOf = node => {
    const [tag, body] = arr(node)
    if (tag === 'code') { return ['code', lexeme(arr(body)[1])] }
    if (tag === 'link') {
        const l = arr(body)
        return ['link', lexeme(l[1]), lexeme(l[3])]
    }
    const [kind, inner] = arr(arr(body)[1])
    return kind === 'strong'
        ? ['strong', lexeme(arr(inner)[1])]
        : ['em', lexeme(arr(inner)[0])]
}

/**
 * A matched entry as its spans: the leading run of text where there is one,
 * then each span and the run of text after it. Both runs are optional in the
 * rule, so an absent one contributes nothing rather than an empty `text`.
 *
 * @type {(node: unknown) => Entry}
 */
const entryOf = node => {
    const [lead, rest] = arr(node)
    /** @type {readonly Inline[]} */
    const head = arr(lead).length === 0 ? [] : [['text', lexeme(lead)]]
    return [...head, ...arr(rest).flatMap(pair => {
        const [span, tail] = arr(pair)
        /** @type {readonly Inline[]} */
        const after = arr(tail).length === 0 ? [] : [['text', lexeme(tail)]]
        return [spanOf(span), ...after]
    })]
}

/**
 * The entries of a release file, as text, with each entry's wrapped lines
 * joined by one space.
 *
 * A `- ` opens an entry, two spaces continue the one before it, and a line
 * with nothing on it closes nothing — the trailing newline every released
 * file ends with is the only such line in the tree.
 *
 * **Any other line is refused, rather than passed over.** A line that is
 * neither — a continuation someone failed to indent, a heading nobody
 * meant — carries words that belong to the release, and dropping it
 * answers with a changelog quietly missing them: the plausible wrong
 * value [`DESIGN.md` §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
 * refuses. The inline half already refuses what it cannot read — that is
 * what pairing its rule with `eof` buys — and this half now says so too.
 *
 * A continuation before any entry is refused for the same reason: it has
 * words and nothing to attach them to.
 *
 * @type {(text: string) => Result<readonly string[], string>}
 */
export const entryTexts = text => {
    // A carriage return is a line ending, not content. A file written on
    // Windows carries one at every break, and refusing it would fail a
    // build over the editor a contributor happened to use.
    const lines = text.split('\n').map(line =>
        line.endsWith('\r') ? line.slice(0, -1) : line)
    /** @type {readonly string[]} */
    let out = []
    let blankAt = -1
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const refuse = /** @type {(why: string) => Result<readonly string[], string>} */(
            why => error(`line ${i + 1}: ${why}`))
        if (line.trim() === '') { blankAt = blankAt === -1 ? i : blankAt }
        else if (blankAt !== -1) {
            // The only blank a released file has is the newline it ends
            // with. A blank anywhere else separates paragraphs inside an
            // entry, or loosens the list between two — either way a
            // structure the entries cannot carry, and joining across it
            // answers with one where the source had two.
            // Named for the blank rather than for the line that followed it:
            // the line here is valid, and the one to delete is the one above.
            return error(
                `line ${blankAt + 1}: a blank line, which only the end of a file may be`)
        }
        else if (line.startsWith('- ')) {
            // **The marker is the dash and the spaces after it.** A second
            // space is indentation, not the first character of the entry:
            // `changelog/0.44.0.md` has one, and keeping it gave that entry
            // a leading `['text', ' ']` span that CommonMark strips and no
            // reader of the page could see.
            out = [...out, line.slice(2).trimStart()]
        }
        else if (line.startsWith('  ') && out.length !== 0) {
            const content = line.trim()
            // An indented marker opens a nested list, which CommonMark
            // reads as a list inside the item and `Entry` cannot hold.
            // Joining it would make one line of prose out of two items.
            if (content.startsWith('- ') || content.startsWith('* ') || content.startsWith('+ ')) {
                return refuse('a nested list item')
            }
            out = [...out.slice(0, -1), `${out[out.length - 1]} ${content}`]
        }
        else { return refuse('neither an entry nor a continuation of one') }
    }
    return ok(out)
}

/**
 * Whether an exclamation mark ends a text span that a link follows, which
 * is an image written in the one way the grammar cannot see.
 *
 * **The grammar reads `!` as ordinary text**, and correctly: an entry ending
 * "and it throws!" is prose. It is only an image when a link follows it
 * immediately, and a rule cannot look that far ahead with the one symbol
 * the backend has. So it is asked here, after recognition, in the place
 * DataJS's own reader asks what its grammar could not
 * ([`ebnf/lib/datajs`](../../ebnf/lib/datajs/module.f.mjs)).
 *
 * CommonMark reads `![alt](u)` as an image; recognised a span at a time it is
 * a `!` and a link, which is a different document rather than a different
 * rendering of one.
 *
 * @type {(entry: Entry) => boolean}
 */
const hasImage = entry => entry.some((span, i) => {
    const next = entry[i + 1]
    return span[0] === 'text' && span[1].endsWith('!')
        && next !== undefined && next[0] === 'link'
})

/**
 * One entry's joined text as its spans, or the position it stopped at.
 *
 * @type {(text: string) => Result<Entry, string>}
 */
export const tryParseEntry = text => {
    const match = parseEntry(units(text))
    if (match[0] === 'error') { return error(`entry: unexpected symbol at ${match[1]}`) }
    const entry = entryOf(arr(arr(match[1])[0])[0])
    return hasImage(entry) ? error('an image, which an entry does not hold') : ok(entry)
}

/**
 * A release file as its entries, or the first that does not parse. The
 * version is the file name and never appears inside the file, so it is no
 * part of what this reads.
 *
 * @type {(text: string) => Result<Document, string>}
 */
export const tryParse = text => {
    const texts = entryTexts(text)
    if (texts[0] === 'error') { return texts }
    /** @type {readonly Entry[]} */
    let out = []
    for (const [i, t] of texts[1].entries()) {
        const one = tryParseEntry(t)
        if (one[0] === 'error') { return error(`entry ${i}: ${one[1]}`) }
        out = [...out, one[1]]
    }
    return ok(out)
}
