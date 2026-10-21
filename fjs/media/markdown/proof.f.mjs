import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.js'
import { runPure } from '../../effects/module.f.mjs'
import { htmlToString } from '../html/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'
import { demo } from './demo.f.mjs'
import { entryTexts, proseSpans, tryParse, tryParseBlocks, tryParseEntry } from './module.f.mjs'

const tick = '`'

/** @type {(text: string) => readonly unknown[]} */
const spans = text => unwrap(tryParseEntry(text))

/** @type {(text: string) => readonly unknown[]} */
const blocks = text => unwrap(tryParseBlocks(text))

/** The refusal of a README, or `null` where it is read. @type {(text: string) => string | null} */
const refusal = text => {
    const r = tryParseBlocks(text)
    return r[0] === 'error' ? r[1] : null
}

/** The refusal of a run of prose, or `null` where it is read. @type {(text: string) => string | null} */
const proseRefusal = text => {
    const r = proseSpans(true)(text)
    return r[0] === 'error' ? r[1] : null
}

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
        // Four spaces after the dash is still indentation, the most
        // CommonMark allows before the text.
        fourSpacesAfterTheDash: () => assertStructurallySame(unwrap(entryTexts('-    a\n')), ['a']),
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
            // Five spaces after the dash make the text an indented code
            // block inside the item, which `Entry` cannot hold.
            indentedCodeAfterTheMarker: () => assertEq(entryTexts('-     code\n')[0], 'error'),
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
        strong: () => assertStructurallySame(spans('**a**'), [['strong', [['text', 'a']]]]),
        // A bold body holds code, opening with it or after text, as a label does.
        strongCode: () => assertStructurallySame(spans(`**${tick}O${tick} is ${tick}r${tick}**`),
            [['strong', [['code', 'O'], ['text', ' is '], ['code', 'r']]]]),
        emCode: () => assertStructurallySame(spans(`*a ${tick}b${tick}*`), [['em', [['text', 'a '], ['code', 'b']]]]),
        // Two backticks open a span that may hold one, and the one space
        // each end carries is stripped, as CommonMark strips it.
        doubleCode: () => assertStructurallySame(spans(`a ${tick}${tick} f${tick}x${tick} ${tick}${tick}`),
            [['text', 'a '], ['code', `f${tick}x${tick}`]]),
        doubleCodeUnpadded: () => assertStructurallySame(spans(`${tick}${tick}a${tick}${tick}`), [['code', 'a']]),
        doubleCodeOneSpace: () => assertStructurallySame(spans(`${tick}${tick} ${tick}${tick}`), [['code', ' ']]),
        // A body of spaces only keeps them all, as CommonMark keeps them.
        doubleCodeSpaces: () => assertStructurallySame(spans(`${tick}${tick}  ${tick}${tick}`), [['code', '  ']]),
        doubleCodeInALabel: () => assertStructurallySame(spans(`[${tick}${tick}a${tick}${tick}](u)`), [['link', [['code', 'a']], 'u']]),
        // An asterisk with a space inside it is no delimiter on GitHub.
        spaceFlanked: () => assertEq(tryParseEntry('a * b * c')[1], 'bold or emphasis padded with a space'),
        paddedStrong: () => assertEq(tryParseEntry('** a**')[1], 'bold or emphasis padded with a space'),
        paddedEm: () => assertEq(tryParseEntry(`*a ${tick}b${tick} *`)[1], 'bold or emphasis padded with a space'),
        paddedAfterCode: () => assertEq(tryParseEntry(`*${tick}b${tick} *`)[1], 'bold or emphasis padded with a space'),
        em: () => assertStructurallySame(spans('*a*'), [['em', [['text', 'a']]]]),
        link: () => assertStructurallySame(spans('[a](b)'), [['link', [['text', 'a']], 'b']]),
        // A target is folded from two parts; the address is both, whole.
        linkTarget: () => assertStructurallySame(
            spans('[#1](https://example.com/p<1>)'), [['link', [['text', '#1']], 'https://example.com/p<1>']]),
        angleBracketedTarget: () => assertEq(tryParseEntry('[x](<https://example.com>)')[0], 'error'),
        // Runs of text and spans alternate, and an absent run contributes
        // nothing rather than an empty `text`.
        alternating: () => assertStructurallySame(
            spans(`a ${tick}b${tick} **c**`),
            [['text', 'a '], ['code', 'b'], ['text', ' '], ['strong', [['text', 'c']]]]),
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
            [['strong', [['text', 'b:']]], ['text', ' two']],
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
            assert(entry.some(s2 => s2[0] === 'em' && s2[1][0][1] === 'always'))
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
            assert(html.includes('Refused:</p><pre data-result="error">'), html)
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
    /**
     * **A run of prose is read as GitHub reads it, or refused.** What the
     * grammar takes as text and GitHub does not is found here, after
     * recognition.
     */
    proseSpans: {
        plain: () => assertStructurallySame(unwrap(proseSpans(true)('a b')), [['text', 'a b']]),
        empty: () => assertStructurallySame(unwrap(proseSpans(true)('')), []),
        // The one autolink form read, as the link it is on GitHub.
        autolink: () => assertStructurallySame(
            unwrap(proseSpans(true)('see <https://example.com> now')),
            [['text', 'see '], ['link', [['text', 'https://example.com']], 'https://example.com'], ['text', ' now']]),
        autolinkAlone: () => assertStructurallySame(
            unwrap(proseSpans(true)('<http://e.x>')),
            [['link', [['text', 'http://e.x']], 'http://e.x']]),
        // A link inside a link is a reading neither side has.
        noAutolinkInALabel: () => assertEq(proseSpans(false)('<https://e.x>')[0], 'error'),
        snakeCase: () => assertEq(proseRefusal('a_b and 9_x_é'), null),
        oneTilde: () => assertEq(proseRefusal('about ~100'), null),
        ampersand: () => assertEq(proseRefusal('a & b, a&; and &x y;'), null),
        ampersandAlone: () => assertEq(proseRefusal('a & b'), null),
        lessThan: () => assertEq(proseRefusal('a < b, a <1 and <'), null),
        refuses: {
            underscore: () => assertEq(proseRefusal('_a_'), 'an underscore that GitHub may read as emphasis at 0'),
            trailingUnderscore: () => assertEq(proseRefusal('a_'), 'an underscore that GitHub may read as emphasis at 1'),
            tildes: () => assertEq(proseRefusal('~~a~~'), 'a tilde pair, which GitHub reads as strikethrough, at 0'),
            entity: () => assertEq(proseRefusal('&amp;'), 'an entity, which GitHub reads as the character it names, at 0'),
            numericEntity: () => assertEq(proseRefusal('&#38;')?.startsWith('an entity'), true),
            bareUrl: () => assertEq(proseRefusal('see https://e.x'), 'a bare URL, which GitHub reads as a link, at 4'),
            bareHttp: () => assertEq(proseRefusal('http://e.x')?.startsWith('a bare URL'), true),
            bareWww: () => assertEq(proseRefusal('www.e.x')?.startsWith('a bare URL'), true),
            html: () => assertEq(proseRefusal('a <b>'), 'raw HTML at 2'),
            closingTag: () => assertEq(proseRefusal('</b>'), 'raw HTML at 0'),
            // A target with a space is no autolink, and GitHub reads the tag.
            notAnAutolink: () => assertEq(proseRefusal('<https://e.x y>'), 'raw HTML at 0'),
            nestedAngle: () => assertEq(proseRefusal('<https://e<x>')?.startsWith('raw HTML'), true),
            unclosedAngle: () => assertEq(proseRefusal('<https://e.x'), 'raw HTML at 0'),
        },
        // Every prose run of an entry goes through it: text, bold and a label.
        inAnEntry: {
            text: () => assertEq(tryParseEntry('_a_')[0], 'error'),
            strong: () => assertEq(tryParseEntry('**a_**')[0], 'error'),
            label: () => assertEq(tryParseEntry('[_a_](u)')[0], 'error'),
            labelWithCode: () => assertStructurallySame(
                spans(`[the ${tick}a${tick} file](u)`),
                [['link', [['text', 'the '], ['code', 'a'], ['text', ' file']], 'u']]),
            codeOnlyLabel: () => assertStructurallySame(
                spans(`[${tick}a${tick}](u)`), [['link', [['code', 'a']], 'u']]),
            emptyLabel: () => assertEq(tryParseEntry('[](u)')[1], 'a link with an empty label'),
            codeIsNotProse: () => assertStructurallySame(spans(`${tick}_a_${tick}`), [['code', '_a_']]),
        },
    },
    /**
     * A README's blocks: headings, paragraphs, code fences and flat lists,
     * and a refusal naming the line of anything GitHub reads otherwise.
     */
    tryParseBlocks: {
        heading: () => assertStructurallySame(blocks('# A\n\n### *b*\n'),
            [['heading', 1, [['text', 'A']]], ['heading', 3, [['em', [['text', 'b']]]]]]),
        paragraph: () => assertStructurallySame(blocks('a\n  b\r\nc\n\nd\n'),
            [['paragraph', [['text', 'a b c']]], ['paragraph', [['text', 'd']]]]),
        // A heading, a fence or a list item ends a paragraph without a blank line.
        paragraphEnds: () => assertStructurallySame(blocks('a\n# h\nb\n```\nc\n```\nd\n- e\n'),
            [['paragraph', [['text', 'a']]], ['heading', 1, [['text', 'h']]], ['paragraph', [['text', 'b']]],
                ['code', '', 'c'], ['paragraph', [['text', 'd']]], ['list', false, [[['paragraph', [['text', 'e']]]]]]]),
        fence: () => assertStructurallySame(blocks('```js\nconst a = 1\n\nb\n```\n'), [['code', 'js', 'const a = 1\n\nb']]),
        list: () => assertStructurallySame(blocks('- a\n  b\n- *c*\n\nd\n'),
            [['list', false, [[['paragraph', [['text', 'a b']]]], [['paragraph', [['em', [['text', 'c']]]]]]]], ['paragraph', [['text', 'd']]]]),
        // A blank line between items, or between two blocks of one item,
        // makes a list loose.
        looseItems: () => assertStructurallySame(blocks('- a\n\n- b\n'),
            [['list', true, [[['paragraph', [['text', 'a']]]], [['paragraph', [['text', 'b']]]]]]]),
        looseItem: () => assertStructurallySame(blocks('- a\n\n  b\n- c\n'),
            [['list', true, [[['paragraph', [['text', 'a']]], ['paragraph', [['text', 'b']]]], [['paragraph', [['text', 'c']]]]]]]),
        // An item holds a fence and a nested list, indented by two spaces; a
        // blank inside the fence or the nested list leaves the outer one tight.
        itemBlocks: () => assertStructurallySame(blocks('- a\n  ```js\n  x\n\n  y\n  ```\n  - b\n\n  - c\n'),
            [['list', false, [[['paragraph', [['text', 'a']]], ['code', 'js', 'x\n\ny'],
                ['list', true, [[['paragraph', [['text', 'b']]]], [['paragraph', [['text', 'c']]]]]]]]]]),
        // A blank line the list does not continue after ends it.
        listEnds: () => assertStructurallySame(blocks('- a\n\nb\n'),
            [['list', false, [[['paragraph', [['text', 'a']]]]]], ['paragraph', [['text', 'b']]]]),
        table: () => assertStructurallySame(blocks('| a | `b` |\n|:-|:-:|\n| c ||\n|d|-:|\n\ne\n'),
            [['table', ['left', 'center'], [[['text', 'a']], [['code', 'b']]], [[[['text', 'c']], []], [[['text', 'd']], [['text', '-:']]]]],
                ['paragraph', [['text', 'e']]]]),
        // A closing pipe is optional, and a lone pipe is one empty cell.
        tableOpenRows: () => assertStructurallySame(blocks('|\n|-|\n|a\n'), [['table', [null], [[]], [[[['text', 'a']]]]]]),
        tableAlignments: () => assertStructurallySame(blocks('|a|b|c|\n|---|--:|-|\n'),
            [['table', [null, 'right', null], [[['text', 'a']], [['text', 'b']], [['text', 'c']]], []]]),
        empty: () => assertStructurallySame(blocks(''), []),
        // A line that opens with an autolink is a paragraph, as on GitHub.
        autolinkLine: () => assertStructurallySame(blocks('<https://e.x>.\n'),
            [['paragraph', [['link', [['text', 'https://e.x']], 'https://e.x'], ['text', '.']]]]),
        // Seven `#`s, or one with no space after it, is prose.
        tabHeading: () => assertStructurallySame(blocks('#\tA\n'), [['heading', 1, [['text', 'A']]]]),
        notAHeading: () => assertStructurallySame(blocks('#a\n\n####### b\n'),
            [['paragraph', [['text', '#a']]], ['paragraph', [['text', '####### b']]]]),
        refuses: {
            fenceInfo: () => assertEq(refusal('```js x\n```\n'), 'line 1: a code fence whose info string is not one word'),
            fenceBacktick: () => assertEq(refusal('```a`\n```\n')?.startsWith('line 1: a code fence'), true),
            unclosedFence: () => assertEq(refusal('a\n\n```\nb\n'), 'line 3: a code fence that is never closed'),
            emptyHeading: () => assertEq(refusal('# \n'), 'line 1: a heading that is empty or closed by `#`'),
            // A marker that ends the line is an empty heading on GitHub, not prose.
            markerOnlyHeading: () => assertEq(refusal('a\n\n###\n'), 'line 3: a heading that is empty or closed by `#`'),
            closedHeading: () => assertEq(refusal('## a ##\n')?.startsWith('line 1: a heading'), true),
            headingSpans: () => assertEq(refusal('\n# _a_\n')?.startsWith('line 2: an underscore'), true),
            tableRowWithoutAPipe: () => assertEq(refusal('|a|\n|-|\nb\n'), 'line 3: a table row that does not open with a pipe'),
            tableRowCells: () => assertEq(refusal('|a|\n|-|\n|b|c|\n'), 'line 3: a table row whose cells do not match its header'),
            tableEscapedPipe: () => assertEq(refusal('|a|\n|-|\n|b\\|c|\n'), 'line 3: an escaped pipe in a table'),
            tableSpans: () => assertEq(refusal('|a|\n|-|\n|_b_|\n')?.startsWith('line 3: an underscore'), true),
            tableHeaderCells: () => assertEq(refusal('|a|b|\n|-|\n'), 'line 1: a table'),
            tableDelimiter: () => assertEq(refusal('|a|\n|:|\n'), 'line 1: a table'),
            tableDelimiterWithoutAPipe: () => assertEq(refusal('|a|\n-\n'), 'line 1: a table'),
            emptyItem: () => assertEq(refusal('- \n'), 'line 1: a list item whose text does not follow its marker'),
            itemIndentedPastItsMarker: () => assertEq(refusal('-  a\n'), 'line 1: a list item whose text does not follow its marker'),
            nestedRefusal: () => assertEq(refusal('- a\n\n  - b\n    > c\n'), 'line 4: a block quote'),
            lazyContinuation: () => assertEq(refusal('- a\nb\n'), 'line 2: a line that GitHub reads as part of the list item above it'),
            headingInAnItem: () => assertEq(refusal('- # a\n'), 'line 1: a heading inside a list item'),
            nestedList: () => assertEq(refusal('- a\n  * b\n'), 'line 2: a list marked other than with `- `'),
            itemIndentedCode: () => assertEq(refusal('-     a\n')?.startsWith('line 1:'), true),
            itemSpans: () => assertEq(refusal('- a\n- _b_\n')?.startsWith('line 2: an underscore'), true),
            paragraphSpans: () => assertEq(refusal('a\n_b_\n')?.startsWith('line 1: an underscore'), true),
            indentedCode: () => assertEq(refusal('    a\n'), 'line 1: an indented code block'),
            quote: () => assertEq(refusal('> a\n'), 'line 1: a block quote'),
            table: () => assertEq(refusal('| a |\n'), 'line 1: a table'),
            tableUnderAHeader: () => assertEq(refusal('a | b\n--- | ---\n'), 'line 2: a table'),
            html: () => assertEq(refusal('<div>\n'), 'line 1: raw HTML'),
            tildeFence: () => assertEq(refusal('~~~\n'), 'line 1: a tilde code fence'),
            starList: () => assertEq(refusal('* a\n'), 'line 1: a list marked other than with `- `'),
            plusList: () => assertEq(refusal('+ a\n'), 'line 1: a list marked other than with `- `'),
            numbered: () => assertEq(refusal('1. a\n'), 'line 1: a numbered list'),
            numberedParen: () => assertEq(refusal('12)\n'), 'line 1: a numbered list'),
            numberIsProse: () => assertEq(refusal('1.5 is a number\n\n2024 a\n\n12\n'), null),
            thematicBreak: () => assertEq(refusal('***\n'), 'line 1: a thematic break or a heading underline'),
            setextUnderline: () => assertEq(refusal('a\n===\n'), 'line 2: a thematic break or a heading underline'),
            hardBreak: () => assertEq(refusal('a  \nb\n'), 'line 1: a hard line break'),
            hardBreakInAnItem: () => assertEq(refusal('- first  \n  second\n'), 'line 1: a hard line break'),
            indentedItem: () => assertEq(refusal('  - a\n'), 'line 1: an indented list item'),
            indentedItemAfterAParagraph: () => assertEq(refusal('a\n  - b\n'), 'line 2: an indented list item'),
            indentedHeading: () => assertEq(refusal('a\n # b\n'), 'line 2: an indented heading'),
            indentedFence: () => assertEq(refusal('  ```\n'), 'line 1: an indented code fence'),
        },
    },
}
