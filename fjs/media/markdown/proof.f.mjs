import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { entryTexts, tryParse, tryParseEntry } from './module.f.mjs'

const tick = '`'

/** @type {(text: string) => readonly unknown[]} */
const spans = text => unwrap(tryParseEntry(text))

export const proof = {
    /**
     * The block layer, which runs before the grammar: a `- ` opens an entry
     * and two spaces continue the one before it.
     */
    entryTexts: {
        one: () => assertStructurallySame(entryTexts('- a\n'), ['a']),
        several: () => assertStructurallySame(entryTexts('- a\n- b\n'), ['a', 'b']),
        // A wrapped line joins with one space, so the entry reads as the
        // sentence it was written as rather than as its layout.
        joinsWrapped: () => assertStructurallySame(entryTexts('- a\n  b\n  c\n'), ['a b c']),
        // The trailing newline every released file ends with closes nothing.
        trailingBlank: () => assertStructurallySame(entryTexts('- a\n\n'), ['a']),
        empty: () => assertStructurallySame(entryTexts(''), []),
    },
    /**
     * **A code span may open on one line and close on the next**, which is
     * the whole reason the lines are joined before the grammar reads them.
     * Twenty lines in the tree are unbalanced on their own for this reason,
     * and a reader that parsed line by line would split every one of them.
     */
    codeSpanAcrossALineBreak: () => assertStructurallySame(
        spans(entryTexts(`- a ${tick}b\n  c${tick} d\n`)[0]),
        [['text', 'a '], ['code', 'b c'], ['text', ' d']]),
    spans: {
        text: () => assertStructurallySame(spans('plain (#1807)'), [['text', 'plain (#1807)']]),
        code: () => assertStructurallySame(spans(`${tick}a${tick}`), [['code', 'a']]),
        strong: () => assertStructurallySame(spans('**a**'), [['strong', 'a']]),
        em: () => assertStructurallySame(spans('*a*'), [['em', 'a']]),
        link: () => assertStructurallySame(spans('[a](b)'), [['link', 'a', 'b']]),
        // Runs of text and spans alternate, and an absent run contributes
        // nothing rather than an empty `text`.
        alternating: () => assertStructurallySame(
            spans(`a ${tick}b${tick} **c**`),
            [['text', 'a '], ['code', 'b'], ['text', ' '], ['strong', 'c']]),
        adjacentSpans: () => assertStructurallySame(
            spans(`${tick}a${tick}${tick}b${tick}`),
            [['code', 'a'], ['code', 'b']]),
    },
    /**
     * **Code binds tightest.** The symbols that open every other span are
     * ordinary inside one, which is what keeps the six entries holding an
     * operator and the forty-three holding an array type readable.
     */
    codeBindsTightest: {
        asterisk: () => assertStructurallySame(spans(`${tick}*${tick}`), [['code', '*']]),
        bracket: () => assertStructurallySame(
            spans(`${tick}readonly T[]${tick}`), [['code', 'readonly T[]']]),
    },
    /** A reference stays text: its link is derived later, from a repository this does not know. */
    referenceIsText: () => assertStructurallySame(
        spans('a (#1807, #1813)'), [['text', 'a (#1807, #1813)']]),
    /** A document is its entries, in the order written. */
    document: () => assertStructurallySame(
        unwrap(tryParse(`- ${tick}a${tick}: one\n  more\n- **b:** two\n`)),
        [
            [['code', 'a'], ['text', ': one more']],
            [['strong', 'b:'], ['text', ' two']],
        ]),
    /** An unclosed delimiter is refused, and the refusal names which entry. */
    refuses: {
        entry: () => assertEq(tryParseEntry(`${tick}unclosed`)[0], 'error'),
        document: () => {
            const r = tryParse(`- fine\n- ${tick}unclosed\n`)
            assertEq(r[0], 'error')
            assertEq(/** @type {string} */(r[1]).startsWith('entry 1:'), true)
        },
    },
}
