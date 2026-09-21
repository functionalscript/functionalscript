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
    },
}
