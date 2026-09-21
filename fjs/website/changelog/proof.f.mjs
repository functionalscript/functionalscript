import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { repository } from '../page/module.f.mjs'
import { _group, _linked, _reference, descending, linked, numbers } from './module.f.mjs'

const pull = /** @type {(n: string) => string} */(n => `${repository}/pull/${n}`)

export const proof = {
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
