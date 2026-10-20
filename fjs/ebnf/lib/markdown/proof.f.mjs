/**
 * @import { RewriteSet } from '../../ll1/types.ts'
 * @import { Utf16 } from '../../utf16/types.ts'
 */

import { eof } from '../../module.f.mjs'
import { parser } from '../../ll1/module.f.mjs'
import { units } from '../../utf16/module.f.mjs'
import { entry } from './module.f.mjs'
import { demo, diagrams } from './demo.f.mjs'
import { assertRecognizes, diagramPage, recognizer } from '../../testlib.f.mjs'

/** @type {RewriteSet<Utf16, never>} */
const nothing = []

/**
 * The whole of one entry, `eof` and all. Pairing the rule with `eof` is what
 * makes a refusal a refusal: without it a prefix matches and the rest of the
 * entry is silently dropped, the way DataJS would read `export default 1;2`
 * as `1`.
 */
const recognize = assertRecognizes(recognizer(parser([entry, eof], nothing), units))

/**
 * A proof that the grammar accepts a whole entry.
 *
 * @type {(text: string) => void}
 */
const accepts = text => recognize([[text, true]])

/**
 * A proof that the grammar refuses an entry.
 *
 * @type {(text: string) => void}
 */
const refuses = text => recognize([[text, false]])

const tick = String.fromCharCode(96)

export const proof = {
    // The shapes the tree actually contains, one of each.
    accepts: {
        empty: () => accepts(''),
        text: () => accepts('ci: CI generation is not stable (#1807, #1813)'),
        code: () => accepts(`${tick}types/bit_vec${tick}: enforce a maximum`),
        strong: () => accepts('**BREAKING CHANGES:** the shape moved'),
        em: () => accepts('a value is *always* a result'),
        link: () => accepts('dispatching to the inherited function [#1421](https://example.com/1421)'),
        // Text runs and spans alternate any number of times, which is the
        // shape `entry` is written to allow.
        alternating: () => accepts(`a ${tick}b${tick} c **d** e *f* g`),
        // A span may open an entry and a span may end one, so neither text
        // run is required.
        spanAtEachEnd: () => accepts(`${tick}a${tick} and ${tick}b${tick}`),
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
        asterisk: () => accepts(`the ${tick}*${tick} operator`),
        bracket: () => accepts(`answers ${tick}readonly T[]${tick} now`),
        both: () => accepts(`${tick}*${tick}, ${tick}/${tick} and ${tick}readonly T[]${tick}`),
    },
    /**
     * A parenthesis is ordinary text. A pull request reference is derived
     * after recognition, so the rules never have to tell `(#1807)` from
     * parenthesised prose — and an unmatched parenthesis is text too.
     */
    parenthesisIsText: {
        reference: () => accepts('the sign is shared (#1807, #1813)'),
        prose: () => accepts('a stale re-export (e.g. one nobody imports)'),
        unmatched: () => accepts('a closing one ) alone'),
    },
    // An unclosed delimiter is refused rather than read as a shorter entry.
    refuses: {
        code: () => refuses(`${tick}unclosed`),
        strong: () => refuses('**unclosed'),
        em: () => refuses('*unclosed'),
        linkWithoutTarget: () => refuses('[#1421]'),
        emptyTarget: () => refuses('[#1421]()'),
        // Neither kind of emphasis has an empty body: `em`'s would begin
        // with the asterisk `strong` begins with, and the two could not then
        // be told apart by the one symbol the backend looks at.
        emptyStrong: () => refuses('****'),
        emptyEm: () => refuses('**'),
        /**
         * **Emphasis refuses what CommonMark would nest.** GitHub renders
         * `**see [details](url)**` as bold around a working link, and every
         * released file is read there as well as on the site. Reading the
         * delimiters as text would give one source two answers; refusing
         * leaves one, and says so at build time. Supporting the nesting is
         * `todo/commonmark-constructs.md`.
         */
        linkInsideStrong: () => refuses(`**see [details](u)**`),
        codeInsideStrong: () => refuses(`**a ${tick}b${tick} c**`),
        codeInsideEm: () => refuses(`*${tick}b${tick}*`),
        // A bracket that opens nothing is refused too. The rule is about
        // the symbol, not about whether it went on to form a span.
        loneBracketInsideStrong: () => refuses(`**a [ b**`),
        /**
         * **A longer delimiter is refused rather than misread.** CommonMark
         * opens a code span with a run of backticks and closes it with a run
         * of the same length, which a writer needs when the code itself holds
         * one. Read one at a time, `` `` ``x`` `` `` is an empty span, an `x`,
         * and another empty span — accepted, and a different document from the
         * one GitHub builds. Refusing an empty span is what stops that.
         */
        longerCodeDelimiter: () => refuses(`${tick}${tick}x${tick}${tick}`),
        emptyCode: () => refuses(`${tick}${tick}`),
        // A link label is where nesting shows, and a target is where it
        // bites: stopping at the first `)` gives the wrong address, with
        // nothing on the page to say so.
        formattingInALinkLabel: () => refuses(`[**details**](u)`),
        codeInALinkLabel: () => refuses(`[${tick}code${tick}](u)`),
        parenthesisInATarget: () => refuses(`[x](a(b)c)`),
        // What a released entry actually carries still reads.
        anOrdinaryLink: () => accepts(`[#1421](https://example.com/pull/1421)`),
        /**
         * **A space beside an asterisk is not emphasis.** CommonMark reads
         * `a * b * c` as the three words and two asterisks they are, and a
         * body admitting the spaces would make an `em` span out of prose —
         * formatting invented rather than read.
         */
        spaceFlankedAsterisks: () => refuses(`a * b * c`),
        paddedEm: () => refuses(`* a *`),
        // A code span loses one leading and trailing space to CommonMark,
        // so keeping them answers with different content.
        paddedCode: () => refuses(`${tick} code ${tick}`),
        // The title form: CommonMark ends the destination at the space and
        // reads the rest as the link title, so admitting it links elsewhere.
        linkTitle: () => refuses(`[x](https://example.com "t")`),
        /**
         * **A backslash escapes the next punctuation mark in CommonMark**,
         * so `[x](a\\)b)` is a link to `a)b` — the parenthesis is content,
         * not the end of the destination. Read without escapes the
         * destination ends early and the link points elsewhere, the same
         * wrong address the parenthesis and the space are refused for.
         */
        backslashInATarget: () => refuses(`[x](a\\)b)`),
        backslashInText: () => refuses(`\\*a\\*`),
        backslashInALabel: () => refuses(`[a\\]b](u)`),
        // The angle-bracket form: CommonMark links to what is between the
        // brackets, so admitting them as target text links elsewhere.
        angleBracketedTarget: () => refuses(`[x](<https://example.com>)`),
        // Only the first symbol opens that form; a later `<` is itself.
        angleBracketLaterInATarget: () => accepts(`[x](a<b)`),
        // What a released entry carries still reads.
        interiorSpaceInEmphasis: () => accepts(`*type parameter*`),
        interiorSpaceInCode: () => accepts(`${tick}nix develop ./nix${tick}`),
    },
    // A diagram per title, and a diagram for every box.
    demo: diagramPage(demo, diagrams),
}
