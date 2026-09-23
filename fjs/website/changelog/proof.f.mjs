/**
 * @import { DemoEvent } from '../demo/types.ts'
 * @import { Inline } from '../../media/markdown/types.ts'
 * @import { Release } from './types.ts'
 */

import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.mjs'
import { repository } from '../page/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { tryParse } from '../../media/markdown/module.f.mjs'
import { demo } from './demo.f.mjs'
import { utf8ToString } from '../../text/module.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { _group, _linked, _reference, descending, isVersion, entryNode, indexPage, linked, numbers, releaseHref, releasePage, releases, spanNode } from './module.f.mjs'

const pull = /** @type {(n: string) => string} */(n => `${repository}/pull/${n}`)

// A release with no neighbours, for a page whose links are not the point.
/** @type {(version: string) => Release} */
const alone = version => ({ version, previous: null, next: null })

// The pure reading half: a reference, a group, a scan, and the order.
const core = {
    reference: {
        pull: () => assertStructurallySame(_reference('#1807'), ['link', '#1807', pull('1807')]),
        // A short SHA is the form for a change whose commit carried no
        // number. No entry in the tree uses it; it is supported against the
        // documented format rather than against data.
        commit: () => assertStructurallySame(
            _reference('7b979e74'), ['link', '7b979e74', `${repository}/commit/7b979e74`]),
        // Shorter than a short SHA is a word, and a word is prose.
        // **A run of hex is a SHA only if it is neither a number nor a
        // word.** Every digit is hex, so a decimal in a note about integer
        // limits would otherwise link to a commit that does not exist — a
        // 404 a reader cannot tell from a real link.
        decimalIsNotASha: () => assertEq(_reference('4294967295'), null),
        wordIsNotASha: () => assertEq(_reference('defaced'), null),
        allDigits: () => assertEq(_reference('1234567'), null),
        mixedIsASha: () => assertEq(_reference('abcdef1')?.[0], 'link'),
        tooShort: () => assertEq(_reference('cafe'), null),
        notHex: () => assertEq(_reference('shipped'), null),
        hashWithoutDigits: () => assertEq(_reference('#'), null),
        empty: () => assertEq(_reference(''), null),
    },
    group: {
        one: () => assertStructurallySame(_group('#1807'), [['link', '#1807', pull('1807')]]),
        // The separator between two references is text, so the group reads
        // as it was written.
        several: () => assertStructurallySame(_group('#1807, #1813'), [
            ['link', '#1807', pull('1807')],
            ['text', ', '],
            ['link', '#1813', pull('1813')],
        ]),
        // "Mixing the two in one entry is fine" — changelog/README.md.
        mixed: () => assertEq(_group('#1807, 7b979e74')?.length, 3),
        // One word that is not a reference makes the whole group prose: a
        // half-linked parenthesis would read as a mistake.
        prose: () => assertEq(_group('shipped in #1656 as a fix'), null),
    },
    linked: {
        // The parentheses stay text; only what is inside becomes a link.
        tail: () => assertStructurallySame(_linked('throws (#1421)'), [
            ['text', 'throws ('],
            ['link', '#1421', pull('1421')],
            ['text', ')'],
        ]),
        prose: () => assertStructurallySame(
            _linked('a stale re-export (e.g. one nobody imports)'),
            [['text', 'a stale re-export (e.g. one nobody imports)']]),
        // A prose parenthesis does not stop the scan: a group after it is
        // still found.
        proseThenGroup: () => assertEq(
            _linked('a (e.g. b) c (#1421)').filter(s => s[0] === 'link').length, 1),
        none: () => assertStructurallySame(_linked('nothing here'), [['text', 'nothing here']]),
        unclosed: () => assertStructurallySame(_linked('a (b'), [['text', 'a (b']]),
    },
    /** Only `text` is scanned: a parenthesis inside code is code. */
    entry: {
        skipsCode: () => assertStructurallySame(
            linked([['code', 'f(#1)'], ['text', ' x (#7)']]),
            [
                ['code', 'f(#1)'],
                ['text', ' x ('],
                ['link', '#7', pull('7')],
                ['text', ')'],
            ]),
        keepsAnExistingLink: () => assertStructurallySame(
            linked([['link', '#1553', 'https://example.com/1553']]),
            [['link', '#1553', 'https://example.com/1553']]),
    },
    /**
     * **Releases do not sort by their names.** Text ordering puts `0.11.10`
     * before `0.11.2` and strands `0.1.608` among the `0.10.x` files, so the
     * index compares numbers.
     */
    /**
     * **A version is the whole shape, not a leading digit.** `0.51.O` begins
     * with one, and taking it would publish a release whose last number is
     * `NaN` — ordering against every other version as neither before nor
     * after, so a typo becomes a misplaced page instead of a refusal.
     */
    isVersion: {
        three: () => assertEq(isVersion('0.50.0'), true),
        long: () => assertEq(isVersion('0.1.608'), true),
        letterForAZero: () => assertEq(isVersion('0.51.O'), false),
        twoParts: () => assertEq(isVersion('0.51'), false),
        fourParts: () => assertEq(isVersion('0.51.0.1'), false),
        emptyPart: () => assertEq(isVersion('0..1'), false),
        empty: () => assertEq(isVersion(''), false),
        // The one that motivated the check: it would have passed a test that
        // only asked whether the name begins with a digit.
        beginsWithADigit: () => assertEq(isVersion('0.51.O'), false),
    },
    order: {
        numbers: () => assertStructurallySame(numbers('0.11.10'), [0, 11, 10]),
        descending: () => assertStructurallySame(
            descending(['0.10.0', '0.11.2', '0.1.608', '0.11.10', '0.2.0']),
            ['0.11.10', '0.11.2', '0.10.0', '0.2.0', '0.1.608']),
        // The text order this replaces, kept as the thing being refused.
        notLexicographic: () => assertEq(descending(['0.11.2', '0.11.10'])[0], '0.11.10'),
        shorterIsSmaller: () => assertStructurallySame(
            descending(['0.11', '0.11.1']), ['0.11.1', '0.11']),
        // The same comparison the other way round, so neither side of it
        // depends on which argument the sort happens to pass first.
        longerFirst: () => assertStructurallySame(
            descending(['0.11.1', '0.11']), ['0.11.1', '0.11']),
        // Two equal versions settle rather than swapping. No directory
        // holds a release twice, but a comparator that never answers
        // "same" is not one, and `sort` is entitled to ask.
        equal: () => assertStructurallySame(
            descending(['0.1.0', '0.1.0']), ['0.1.0', '0.1.0']),
    },
}

// The page half: spans to elements, and the two kinds of page.
const render = {
    span: {
        // Prose has no tag of its own: wrapping it would put a `span` around
        // two thirds of every entry.
        text: () => assertEq(spanNode(['text', 'a']), 'a'),
        code: () => assertStructurallySame(spanNode(['code', 'a']), ['code', 'a']),
        strong: () => assertStructurallySame(spanNode(['strong', 'a']), ['strong', 'a']),
        em: () => assertStructurallySame(spanNode(['em', 'a']), ['em', 'a']),
        link: () => assertStructurallySame(
            spanNode(['link', 'a', 'u']), ['a', { href: 'u' }, 'a']),
    },
    /** An entry's references are linked on the way to the page. */
    entry: () => assert(
        htmlToString(entryNode([['text', 'x (#1421)']])).includes(
        `<li>x (<a href="${pull('1421')}">#1421</a>)</li>`)),
    release: {
        page: () => {
            const html = utf8ToString(releasePage(alone('0.41.0'))([[['code', 'a']]]))
            assert(html.includes('<title>FunctionalScript 0.41.0</title>'), html)
            assert(html.includes('<h1>0.41.0</h1>'), html)
            assert(html.includes('<li><code>a</code></li>'), html)
            // Every page of the site carries the same stylesheet and icons.
            assert(html.includes('/_main.css'), html)
        },
        // `changelog/README.md`: "A `<version>.md` file that is empty records
        // a release that shipped no notable change." `0.1.608` is one.
        empty: () => {
            const html = utf8ToString(releasePage(alone('0.1.608'))([]))
            assert(html.includes('shipped no notable change'), html)
            assert(!html.includes('<ul>'), html)
        },
        // `index.html` and the `_`-prefixed names are the only two a
        // generator may write into the served tree.
        href: () => assertEq(releaseHref('0.41.0'), '/changelog/_0.41.0.html'),
    },
    /**
     * **Previous is older, next is newer**, as a release's "previous" reads,
     * and the list is in version order rather than name order.
     */
    releases: {
        neighbours: () => assertStructurallySame(
            releases(['0.11.2', '0.11.10', '0.10.0']),
            [
                { version: '0.11.10', previous: '0.11.2', next: null },
                { version: '0.11.2', previous: '0.10.0', next: '0.11.10' },
                { version: '0.10.0', previous: null, next: '0.11.2' },
            ]),
        one: () => assertStructurallySame(
            releases(['0.1.0']), [{ version: '0.1.0', previous: null, next: null }]),
        none: () => assertStructurallySame(releases([]), []),
    },
    /** The links sit under the heading, above the entries. */
    navigation: {
        both: () => {
            const html = utf8ToString(releasePage(
                { version: '0.47.0', previous: '0.46.0', next: '0.48.0' })([[['text', 'x']]]))
            assert(html.includes(
                '<h1>0.47.0</h1><nav aria-label="Releases">'
                + '<a href="/changelog/_0.46.0.html" rel="prev"><span aria-hidden="true">← </span>Previous: 0.46.0</a>'
                + ' · '
                + '<a href="/changelog/_0.48.0.html" rel="next">Next: 0.48.0<span aria-hidden="true"> →</span></a>'
                + '</nav><ul>'), html)
        },
        // The oldest release has nothing before it, and says only what is.
        oldest: () => {
            const html = utf8ToString(releasePage({ version: '0.1.0', previous: null, next: '0.1.1' })([]))
            assert(html.includes('Next: 0.1.1'), html)
            assert(!html.includes('Previous:'), html)
            assert(!html.includes(' · '), html)
        },
        newest: () => {
            const html = utf8ToString(releasePage({ version: '0.48.0', previous: '0.47.0', next: null })([]))
            assert(html.includes('Previous: 0.47.0'), html)
            assert(!html.includes('Next:'), html)
        },
        // A lone release has no neighbours, and an empty landmark would be
        // one a screen reader announces with nothing in it.
        alone: () => {
            const html = utf8ToString(releasePage(alone('0.1.0'))([]))
            assert(!html.includes('aria-label="Releases"'), html)
        },
    },
    index: {
        newestFirst: () => {
            const html = utf8ToString(indexPage(['0.11.2', '0.11.10']))
            assert(html.indexOf('_0.11.10.html') < html.indexOf('_0.11.2.html'), html)
        },
        linksEvery: () => assertEq(
            utf8ToString(indexPage(['0.1.0', '0.2.0', '0.3.0'])).split('changelog/_').length - 1, 3),
    },
}

/**
 * The demo's initial text carries the four cases the derivation has to tell
 * apart, so a reader meets all of them before changing anything.
 */
const demoCases = {
    // One bare reference, a group of three, one link already written out,
    // and a parenthesis that is prose.
    everyCase: () => {
        const document = unwrap(tryParse(demo.init))
        assertEq(document.length, 4)
        const links = document.flatMap(linked).filter(
            /** @type {(span: Inline) => boolean} */(span => span[0] === 'link'))
        assertEq(links.length, 5)
        // Four of the five are this module's work; the fifth was published
        // with its link and keeps it.
        assertEq(links.filter(
            /** @type {(l: Inline) => boolean} */(l => l[0] === 'link' && l[2].endsWith('/pull/1553'))).length, 1)
    },
    // A group of three becomes three links with its commas left as text.
    aGroupOfThree: () => {
        const html = htmlToString(demo.view(demo.init))
        for (const n of ['1807', '1813', '1825']) { assert(html.includes(`/pull/${n}">#${n}</a>`), n) }
    },
    // The rule a half-linked parenthesis would break: all references or none.
    proseIsLeftAlone: () => {
        const html = htmlToString(demo.view(demo.init))
        assert(html.includes('(e.g. one nobody imports)'), html)
    },
    // The count is the module's job, said rather than left to be spotted.
    saysWhatItDerived: () => {
        const html = htmlToString(demo.view(demo.init))
        assert(html.includes('4 references derived'), html)
        assert(html.includes('1 link already written out'), html)
    },
    // A file that does not parse is shown, not swallowed, and draws no list.
    error: () => {
        const html = htmlToString(demo.view('- x\ny'))
        assert(html.includes('Error:'), html)
        assert(!html.includes('<ul>'), html)
    },
    view: () => assert(htmlToString(demo.view(demo.init)).includes('name="release"')),
    // Typing replaces the text; every other event leaves it alone.
    update: () => {
        /** @type {(event: DemoEvent) => (state: string) => string} */
        const step = event => state => unwrap(assertNotNullish(
            runPure(demo.update(state)(event))[0],
            'expected the demo to reach a value without asking for an operation'))
        assertEq(step({ kind: 'input', name: 'release', value: '- a' })(''), '- a')
        assertEq(step({ kind: 'start' })('kept'), 'kept')
    },
}

/** Everything this module owes: what it reads, what it draws, and its demo. */
export const proof = { ...core, render, demo: demoCases }
