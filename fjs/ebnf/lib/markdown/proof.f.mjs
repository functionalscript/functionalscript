/**
 * @import { RewriteSet } from '../../ll1/types.ts'
 * @import { Utf16 } from '../../utf16/types.ts'
 */

import { assert } from '../../../asserts/module.f.mjs'
import { eof } from '../../module.f.mjs'
import { parser } from '../../ll1/module.f.mjs'
import { units } from '../../utf16/module.f.mjs'
import { entry } from './module.f.mjs'

/** @type {RewriteSet<Utf16, never>} */
const nothing = []

/**
 * The whole of one entry, `eof` and all. Pairing the rule with `eof` is what
 * makes a refusal a refusal: without it a prefix matches and the rest of the
 * entry is silently dropped, the way DataJS would read `export default 1;2`
 * as `1`.
 */
const parse = parser([entry, eof], nothing)

/**
 * Whether the grammar accepts a whole entry.
 *
 * @type {(text: string) => boolean}
 */
const accepts = text => parse(units(text))[0] !== 'error'

const tick = String.fromCharCode(96)

export const proof = {
    // The shapes the tree actually contains, one of each.
    accepts: {
        empty: () => assert(accepts('')),
        text: () => assert(accepts('ci: CI generation is not stable (#1807, #1813)')),
        code: () => assert(accepts(`${tick}types/bit_vec${tick}: enforce a maximum`)),
        strong: () => assert(accepts('**BREAKING CHANGES:** the shape moved')),
        em: () => assert(accepts('a value is *always* a result')),
        link: () => assert(accepts('dispatching to the inherited function [#1421](https://example.com/1421)')),
        // Text runs and spans alternate any number of times, which is the
        // shape `entry` is written to allow.
        alternating: () => assert(accepts(`a ${tick}b${tick} c **d** e *f* g`)),
        // A span may open an entry and a span may end one, so neither text
        // run is required.
        spanAtEachEnd: () => assert(accepts(`${tick}a${tick} and ${tick}b${tick}`)),
    },
    /**
     * **Code binds tightest**, which is the property the corpus forces: a
     * code span carries the very symbols the other spans are delimited by.
     * Six entries in the tree hold an asterisk inside code as an operator,
     * and forty-three hold a bracket inside code as an array type. Both
     * would leave the entry unbalanced if emphasis or a link were recognised
     * first, so both parse here and neither opens a span.
     */
    codeBindsTightest: {
        asterisk: () => assert(accepts(`the ${tick}*${tick} operator`)),
        bracket: () => assert(accepts(`answers ${tick}readonly T[]${tick} now`)),
        both: () => assert(accepts(`${tick}*${tick}, ${tick}/${tick} and ${tick}readonly T[]${tick}`)),
    },
    /**
     * A parenthesis is ordinary text. A pull request reference is derived
     * after recognition, so the rules never have to tell `(#1807)` from
     * parenthesised prose — and an unmatched parenthesis is text too.
     */
    parenthesisIsText: {
        reference: () => assert(accepts('the sign is shared (#1807, #1813)')),
        prose: () => assert(accepts('a stale re-export (e.g. one nobody imports)')),
        unmatched: () => assert(accepts('a closing one ) alone')),
    },
    // An unclosed delimiter is refused rather than read as a shorter entry.
    refuses: {
        code: () => assert(!accepts(`${tick}unclosed`)),
        strong: () => assert(!accepts('**unclosed')),
        em: () => assert(!accepts('*unclosed')),
        linkWithoutTarget: () => assert(!accepts('[#1421]')),
        emptyTarget: () => assert(!accepts('[#1421]()')),
        // Neither kind of emphasis has an empty body: `em`'s would begin
        // with the asterisk `strong` begins with, and the two could not then
        // be told apart by the one symbol the backend looks at.
        emptyStrong: () => assert(!accepts('****')),
        emptyEm: () => assert(!accepts('**')),
        /**
         * **Emphasis refuses what CommonMark would nest.** GitHub renders
         * `**see [details](url)**` as bold around a working link, and every
         * released file is read there as well as on the site. Reading the
         * delimiters as text would give one source two answers; refusing
         * leaves one, and says so at build time. Supporting the nesting is
         * `todo/commonmark-constructs.md`.
         */
        linkInsideStrong: () => assert(!accepts(`**see [details](u)**`)),
        codeInsideStrong: () => assert(!accepts(`**a ${tick}b${tick} c**`)),
        codeInsideEm: () => assert(!accepts(`*${tick}b${tick}*`)),
        // A bracket that opens nothing is refused too. The rule is about
        // the symbol, not about whether it went on to form a span.
        loneBracketInsideStrong: () => assert(!accepts(`**a [ b**`)),
        /**
         * **A longer delimiter is refused rather than misread.** CommonMark
         * opens a code span with a run of backticks and closes it with a run
         * of the same length, which a writer needs when the code itself holds
         * one. Read one at a time, `` `` ``x`` `` `` is an empty span, an `x`,
         * and another empty span — accepted, and a different document from the
         * one GitHub builds. Refusing an empty span is what stops that.
         */
        longerCodeDelimiter: () => assert(!accepts(`${tick}${tick}x${tick}${tick}`)),
        emptyCode: () => assert(!accepts(`${tick}${tick}`)),
        // A link label is where nesting shows, and a target is where it
        // bites: stopping at the first `)` gives the wrong address, with
        // nothing on the page to say so.
        formattingInALinkLabel: () => assert(!accepts(`[**details**](u)`)),
        codeInALinkLabel: () => assert(!accepts(`[${tick}code${tick}](u)`)),
        parenthesisInATarget: () => assert(!accepts(`[x](a(b)c)`)),
        // What a released entry actually carries still reads.
        anOrdinaryLink: () => assert(accepts(`[#1421](https://example.com/pull/1421)`)),
        /**
         * **A space beside an asterisk is not emphasis.** CommonMark reads
         * `a * b * c` as the three words and two asterisks they are, and a
         * body admitting the spaces would make an `em` span out of prose —
         * formatting invented rather than read.
         */
        spaceFlankedAsterisks: () => assert(!accepts(`a * b * c`)),
        paddedEm: () => assert(!accepts(`* a *`)),
        // A code span loses one leading and trailing space to CommonMark,
        // so keeping them answers with different content.
        paddedCode: () => assert(!accepts(`${tick} code ${tick}`)),
        // The title form: CommonMark ends the destination at the space and
        // reads the rest as the link title, so admitting it links elsewhere.
        linkTitle: () => assert(!accepts(`[x](https://example.com "t")`)),
        /**
         * **A backslash escapes the next punctuation mark in CommonMark**,
         * so `[x](a\\)b)` is a link to `a)b` — the parenthesis is content,
         * not the end of the destination. Read without escapes the
         * destination ends early and the link points elsewhere, the same
         * wrong address the parenthesis and the space are refused for.
         */
        backslashInATarget: () => assert(!accepts(`[x](a\\)b)`)),
        backslashInText: () => assert(!accepts(`\\*a\\*`)),
        backslashInALabel: () => assert(!accepts(`[a\\]b](u)`)),
        // What a released entry carries still reads.
        interiorSpaceInEmphasis: () => assert(accepts(`*type parameter*`)),
        interiorSpaceInCode: () => assert(accepts(`${tick}nix develop ./nix${tick}`)),
    },
}
