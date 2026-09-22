import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { htmlToString } from '../html/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { demo } from './demo.f.mjs'
import { entryTexts, tryParse, tryParseEntry } from './module.f.mjs'

const tick = '`'

/** @type {(text: string) => readonly unknown[]} */
const spans = text => unwrap(tryParseEntry(text))

export const proof = {
    /**
     * The block layer, which runs before the grammar: a `- ` opens an entry,
     * two spaces continue the one before it, and anything else with words on
     * it is refused rather than passed over.
     */
    entryTexts: {
        one: () => assertStructurallySame(unwrap(entryTexts('- a\n')), ['a']),
        several: () => assertStructurallySame(unwrap(entryTexts('- a\n- b\n')), ['a', 'b']),
        // A wrapped line joins with one space, so the entry reads as the
        // sentence it was written as rather than as its layout.
        joinsWrapped: () => assertStructurallySame(unwrap(entryTexts('- a\n  b\n  c\n')), ['a b c']),
        // The trailing newline every released file ends with closes nothing.
        trailingBlank: () => assertStructurallySame(unwrap(entryTexts('- a\n\n')), ['a']),
        // A line of nothing but the indent carries no words, so it continues
        // nothing and is not refused either — joining it would put a trailing
        // space on the entry above it.
        blankIndented: () => assertStructurallySame(unwrap(entryTexts('- a\n   \n')), ['a']),
        // **The marker is the dash and the spaces after it.** A second
        // space is indentation, not the entry's first character:
        // `changelog/0.44.0.md` has one, and keeping it gave that entry a
        // leading empty-looking `text` span that CommonMark strips.
        twoSpacesAfterTheDash: () => assertStructurallySame(unwrap(entryTexts('-  a\n')), ['a']),
        // A carriage return is a line ending, not content. A file written
        // on Windows carries one at every break.
        crlf: () => assertStructurallySame(unwrap(entryTexts('- a\r\n  b\r\n')), ['a b']),
        empty: () => assertStructurallySame(unwrap(entryTexts('')), []),
        /**
         * **A line that is neither is refused, and says which line it was.**
         * It carries words that belong to the release, so passing over it
         * answers with a changelog quietly missing them — the plausible wrong
         * value `DESIGN.md` §10 refuses. No released file in the tree has such
         * a line; a file being edited can.
         */
        refuses: {
            unindentedContinuation: () => assertEq(entryTexts('- a\nb\n')[0], 'error'),
            heading: () => assertEq(entryTexts('# not a release\n')[0], 'error'),
            // A continuation before any entry has words and nothing to
            // attach them to.
            orphanContinuation: () => assertEq(entryTexts('  orphan\n- a\n')[0], 'error'),
            // An indented marker opens a nested list, which CommonMark
            // reads as a list inside the item and `Entry` cannot hold.
            nestedListItem: () => assertEq(entryTexts('- parent\n  - child\n')[0], 'error'),
            nestedWithAStar: () => assertEq(entryTexts('- parent\n  * child\n')[0], 'error'),
            // A blank line between two lines with words on them is a
            // paragraph break, which an entry has no room for.
            interiorBlank: () => assertEq(entryTexts('- first\n\n  second\n')[0], 'error'),
            // The same refusal covers a blank between two entries and one
            // before the first, so it is named for what it checks rather
            // than for the case that prompted it.
            blankBetweenEntries: () => assertEq(entryTexts('- a\n\n- b\n')[0], 'error'),
            leadingBlank: () => assertEq(entryTexts('\n- a\n')[0], 'error'),
            namesTheBlank: () => assertEq(entryTexts('- a\n\n- b\n')[1],
                'line 2: a blank line, which only the end of a file may be'),
            saysWhichLine: () => assertEq(entryTexts('- a\nb\n')[1], 'line 2: neither an entry nor a continuation of one'),
        },
    },
    /**
     * **A code span may open on one line and close on the next**, which is
     * the whole reason the lines are joined before the grammar reads them.
     * Twenty lines in the tree are unbalanced on their own for this reason,
     * and a reader that parsed line by line would split every one of them.
     */
    codeSpanAcrossALineBreak: () => assertStructurallySame(
        spans(unwrap(entryTexts(`- a ${tick}b\n  c${tick} d\n`))[0]),
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
    /**
     * The demo's initial text is chosen to carry every property the parser
     * has, so a reader meets them before changing anything. Two of them are
     * invisible in a rendering and show only in the spans.
     */
    demo: {
        // A code span opens on one line of the first entry and closes on the
        // next. It reaches the spans whole, which is what the block layer is
        // for, and the joined text is what a reader wrote rather than how it
        // wrapped.
        joinsACodeSpanAcrossALineBreak: () => {
            const entries = unwrap(tryParse(demo.init))
            assert(entries[0].some(s2 => s2[0] === 'code' && s2[1] === 'own property'))
        },
        // The second entry holds both symbols that only stay readable because
        // code is recognised first, and holds a real emphasis beside the
        // asterisk it would otherwise have opened.
        codeBindsTightest: () => {
            const entry = unwrap(tryParse(demo.init))[1]
            assert(entry.some(s2 => s2[0] === 'code' && s2[1] === 'readonly T[]'))
            assert(entry.some(s2 => s2[0] === 'code' && s2[1] === '*'))
            assert(entry.some(s2 => s2[0] === 'em' && s2[1] === 'always'))
        },
        // Every kind the grammar has, and a reference left as text.
        everyKind: () => {
            const kinds = new Set(unwrap(tryParse(demo.init)).flat().map(s2 => s2[0]))
            assert(kinds.has('text'))
            assert(kinds.has('code'))
            assert(kinds.has('strong'))
            assert(kinds.has('em'))
            assert(kinds.has('link'))
            assert(unwrap(tryParse(demo.init))[0].some(
                s2 => s2[0] === 'text' && s2[1].includes('(#1421)')))
        },
        // A file that does not parse is said so, not swallowed, and draws no list.
        error: () => {
            const html = htmlToString(demo.view('- ' + tick + 'unclosed'))
            assert(html.includes('Error:'), html)
            assert(!html.includes('<ol>'), html)
        },
        view: () => assert(htmlToString(demo.view(demo.init)).includes('name="changelog"')),
        // Typing replaces the text; every other event leaves it alone.
        update: () => {
            /** @type {(event: { readonly kind: 'input', readonly name: string, readonly value: string } | { readonly kind: 'start' }) => (state: string) => string} */
            const step = event => state => unwrap(assertNotNullish(
                runPure(demo.update(state)(event))[0],
                'expected the demo to reach a value without asking for an operation'))
            assertEq(step({ kind: 'input', name: 'changelog', value: '- a' })(''), '- a')
            assertEq(step({ kind: 'start' })('kept'), 'kept')
        },
    },
    /** An unclosed delimiter is refused, and the refusal names which entry. */
    refuses: {
        // A document is refused for either half: a line the block layer
        // cannot place, as well as a delimiter the grammar cannot close.
        blockLine: () => {
            const r = tryParse('- fine\nb\n')
            assertEq(r[0], 'error')
            assertEq(/** @type {string} */(r[1]).startsWith('line 2:'), true)
        },
        entry: () => assertEq(tryParseEntry(`${tick}unclosed`)[0], 'error'),
        /**
         * **An image is refused after recognition, not by a rule.** The
         * grammar reads `!` as ordinary text, and correctly — an entry
         * ending "it throws!" is prose. It is an image only when a link
         * follows immediately, which one symbol of lookahead cannot see.
         */
        image: () => assertEq(tryParseEntry('![alt](https://example.com/i.png)')[0], 'error'),
        imageInsideAnEntry: () => assertEq(
            tryParseEntry('a ![x](https://example.com/y.png) b')[0], 'error'),
        // Prose ending in an exclamation mark is prose.
        exclamationIsText: () => assertEq(tryParseEntry('and it throws!')[0], 'ok'),
        exclamationBeforeALink: () => assertEq(
            tryParseEntry('done! [#1](https://example.com/pull/1)')[0], 'ok'),
        document: () => {
            const r = tryParse(`- fine\n- ${tick}unclosed\n`)
            assertEq(r[0], 'error')
            assertEq(/** @type {string} */(r[1]).startsWith('entry 1:'), true)
        },
    },
}
