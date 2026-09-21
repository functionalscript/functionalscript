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
 * The input units under a node, in order. A variant's tag is a string rather
 * than a symbol and is passed over, as it is in JSON's own reader.
 *
 * @type {(node: unknown) => readonly number[]}
 */
const unitsUnder = node =>
    typeof node === 'string' ? [] :
    node instanceof Array ? node.flatMap(unitsUnder) :
    [symbolAt(/** @type {Meta<Utf16>} */(node)).symbol]

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
 * A `- ` opens an entry and two spaces continue the one before it; anything
 * else — the trailing newline every file ends with is the only case in the
 * tree — closes nothing and adds nothing.
 *
 * @type {(text: string) => readonly string[]}
 */
export const entryTexts = text => text.split('\n').reduce(
    (acc, line) =>
        line.startsWith('- ') ? [...acc, line.slice(2)] :
        line.startsWith('  ') && line.trim() !== '' && acc.length !== 0
            ? [...acc.slice(0, -1), `${acc[acc.length - 1]} ${line.trim()}`]
            : acc,
    /** @type {readonly string[]} */([]))

/**
 * One entry's joined text as its spans, or the position it stopped at.
 *
 * @type {(text: string) => Result<Entry, string>}
 */
export const tryParseEntry = text => {
    const match = parseEntry(units(text))
    return match[0] === 'error'
        ? error(`entry: unexpected symbol at ${match[1]}`)
        : ok(entryOf(arr(arr(match[1])[0])[0]))
}

/**
 * A release file as its entries, or the first that does not parse. The
 * version is the file name and never appears inside the file, so it is no
 * part of what this reads.
 *
 * @type {(text: string) => Result<Document, string>}
 */
export const tryParse = text => {
    /** @type {readonly Entry[]} */
    let out = []
    for (const [i, t] of entryTexts(text).entries()) {
        const one = tryParseEntry(t)
        if (one[0] === 'error') { return error(`entry ${i}: ${one[1]}`) }
        out = [...out, one[1]]
    }
    return ok(out)
}
