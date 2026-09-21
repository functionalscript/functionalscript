import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { repository } from '../page/module.f.mjs'
import { utf8ToString } from '../../text/module.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { _group, _linked, _reference, descending, entryNode, indexPage, linked, numbers, releaseHref, releasePage, spanNode } from './module.f.mjs'

const pull = /** @type {(n: string) => string} */(n => `${repository}/pull/${n}`)

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
    order: {
        numbers: () => assertStructurallySame(numbers('0.11.10'), [0, 11, 10]),
        descending: () => assertStructurallySame(
            descending(['0.10.0', '0.11.2', '0.1.608', '0.11.10', '0.2.0']),
            ['0.11.10', '0.11.2', '0.10.0', '0.2.0', '0.1.608']),
        // The text order this replaces, kept as the thing being refused.
        notLexicographic: () => assertEq(descending(['0.11.2', '0.11.10'])[0], '0.11.10'),
        shorterIsSmaller: () => assertStructurallySame(
            descending(['0.11', '0.11.1']), ['0.11.1', '0.11']),
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
            const html = utf8ToString(releasePage('0.41.0')([[['code', 'a']]]))
            assert(html.includes('<title>FunctionalScript 0.41.0</title>'), html)
            assert(html.includes('<h1>0.41.0</h1>'), html)
            assert(html.includes('<li><code>a</code></li>'), html)
            // Every page of the site carries the same stylesheet and icons.
            assert(html.includes('/_main.css'), html)
        },
        // `changelog/README.md`: "A `<version>.md` file that is empty records
        // a release that shipped no notable change." `0.1.608` is one.
        empty: () => {
            const html = utf8ToString(releasePage('0.1.608')([]))
            assert(html.includes('shipped no notable change'), html)
            assert(!html.includes('<ul>'), html)
        },
        // `index.html` and the `_`-prefixed names are the only two a
        // generator may write into the served tree.
        href: () => assertEq(releaseHref('0.41.0'), '/changelog/_0.41.0.html'),
    },
    index: {
        newestFirst: () => {
            const html = utf8ToString(indexPage(['0.11.2', '0.11.10']))
            assert(html.indexOf('_0.11.10.html') < html.indexOf('_0.11.2.html'), html)
        },
        linksEvery: () => assertEq(
            (utf8ToString(indexPage(['0.1.0', '0.2.0', '0.3.0'])).match(/changelog\/_/g) ?? []).length, 3),
    },
}

/** Everything this module owes: what it reads, and what it draws. */
export const proof = { ...core, render }
