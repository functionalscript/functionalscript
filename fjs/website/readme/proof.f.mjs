/**
 * Proofs for a README as the top of its page.
 *
 * @import { Blocks } from '../../media/markdown/types.ts'
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { anchors, readmeName, readmeNodes, readmeSection, resolveHref, slug } from './module.f.mjs'

/** Pages for the root, `spec` and `spec/a`, and none for anything else. @type {(path: string) => boolean} */
const isPage = path => path === '.' || path === 'spec' || path === 'spec/a'

/** Links from `spec/a`'s README, in a build with no commit. */
const local = resolveHref(null)(isPage)('spec/a')

/** A link refused for a target named `bad`, and every other kept. */
const href = (/** @type {string} */ h) => h === 'bad' ? error('no') : ok(h)

export const proof = {
    readmeName: () => assertEq(readmeName, 'README.md'),
    resolveHref: {
        absolute: () => assertStructurallySame(local('https://e.x/a:b'), ok('https://e.x/a:b')),
        mailto: () => assertStructurallySame(local('mailto:a@e.x'), ok('mailto:a@e.x')),
        fragment: () => assertStructurallySame(local('#x'), ok('#x')),
        // A scheme that runs code, or that a page does not open, is refused.
        networkPath: () => assertStructurallySame(local('//e.x/a'), error('a link with no scheme: //e.x/a')),
        javascript: () => assertStructurallySame(local('JavaScript:alert(1)'), error('a link with a scheme a page does not open: javascript:')),
        query: () => assertStructurallySame(local('x.md?raw=1#L2'), ok('/spec/a/x.md?raw=1#L2')),
        queryOnADirectory: () => assertStructurallySame(local('..?a#b'), ok('/spec/index.html?a#b')),
        // A colon after the first slash is part of a path, not a scheme.
        colonInAPath: () => assertStructurallySame(local('b/c:d'), ok('/spec/a/b/c%3Ad')),
        directory: () => assertStructurallySame(local('..'), ok('/spec/index.html')),
        directorySlash: () => assertStructurallySame(local('../'), ok('/spec/index.html')),
        readme: () => assertStructurallySame(local('../README.md#y'), ok('/spec/index.html#y')),
        // A README with no page of its own is the file.
        otherReadme: () => assertStructurallySame(local('b/README.md'), ok('/spec/a/b/README.md')),
        file: () => assertStructurallySame(local('./module.f.mjs#L1'), ok('/spec/a/module.f.mjs#L1')),
        rootRelative: () => assertStructurallySame(local('/doc/D.md'), ok('/doc/D.md')),
        root: () => assertStructurallySame(local('/#x'), ok('/index.html#x')),
        rootUp: () => assertStructurallySame(local('../..'), ok('/index.html')),
        github: () => assertStructurallySame(resolveHref('abc')(isPage)('spec/a')('x.md'),
            ok('https://github.com/functionalscript/functionalscript/blob/abc/spec/a/x.md')),
        escapes: () => assertStructurallySame(local('../../../x'), error('a link that leaves the repository: ../../../x')),
        percentEscape: () => assertStructurallySame(local('my%20file.md'), error('a link with a percent escape: my%20file.md')),
    },
    slug: {
        words: () => assertEq(slug([['text', 'Hello, World!']]), 'hello-world'),
        spans: () => assertEq(slug([['code', 'a_b'], ['text', ' – '], ['link', [['text', 'C'], ['code', 'd']], 'u'], ['em', 'É']]), 'a_b--cdé'),
        // An uncased script stays, as GitHub keeps it; its punctuation, a
        // symbol and an emoji go.
        uncased: () => assertEq(slug([['text', '中文、テスト → ok ✓ 😀 한 a×b§']]), '中文テスト--ok---한-ab'),
        // A character it cannot class is left out of the slug; the README
        // is refused before the slug is used.
        unknown: () => assertEq(slug([['text', 'aأ']]), 'a'),
        // A Han ideograph past the first plane stays, as GitHub keeps it.
        supplementaryHan: () => assertEq(slug([['text', '𠀀 x']]), '𠀀-x'),
        kanaPunctuation: () => assertEq(slug([['text', 'ア・イ゛゠ー']]), 'アイー'),
        // Past the emoji blocks, nothing is known to be dropped.
        legacySymbol: () => assertEq(slug([['text', 'a\u{1fb00}']]), 'a'),
        digits: () => assertEq(slug([['strong', '10-2']]), '10-2'),
    },
    anchors: () => assertStructurallySame(
        anchors([['heading', 1, [['text', 'A']]], ['paragraph', []], ['heading', 2, [['text', 'a']]], ['heading', 2, [['text', 'B']]], ['heading', 3, [['text', 'A']]]]),
        ['a', 'a-1', 'b', 'a-2']),
    // A suffixed anchor a heading already has is not given again.
    anchorsSkipTaken: () => assertStructurallySame(
        anchors([['heading', 1, [['text', 'A']]], ['heading', 1, [['text', 'A-1']]], ['heading', 1, [['text', 'A']]]]),
        ['a', 'a-1', 'a-2']),
    readmeNodes: {
        all: () => {
            /** @type {Blocks} */
            const blocks = [
                ['heading', 1, [['text', 'T']]],
                ['heading', 6, [['text', 'S']]],
                ['paragraph', [['text', 'a '], ['code', 'b'], ['strong', 'c'], ['em', 'd'], ['link', [['text', 'e '], ['code', 'f']], 'g']]],
                ['code', 'js', 'x'],
                ['code', '', 'y'],
                ['list', [[['text', 'i']], [['text', 'j']]]],
            ]
            assertStructurallySame(readmeNodes(href)(blocks), ok([
                ['h2', { id: 't' }, 'T'],
                ['h6', { id: 's' }, 'S'],
                ['p', 'a ', ['code', 'b'], ['strong', 'c'], ['em', 'd'], ['a', { href: 'g' }, 'e ', ['code', 'f']]],
                ['pre', ['code', { class: 'language-js' }, 'x']],
                ['pre', ['code', 'y']],
                ['ul', ['li', 'i'], ['li', 'j']],
            ]))
        },
        // A link it cannot place refuses the README, wherever it stands.
        refuses: {
            heading: () => assertStructurallySame(readmeNodes(href)([['heading', 1, [['link', [['text', 'x']], 'bad']]]]), error('no')),
            paragraph: () => assertStructurallySame(readmeNodes(href)([['paragraph', [['text', 'a'], ['link', [['text', 'x']], 'bad']]]]), error('no')),
            list: () => assertStructurallySame(readmeNodes(href)([['list', [[['link', [['text', 'x']], 'bad']]]]]), error('no')),
            // An Arabic comma is punctuation GitHub drops, and nothing here
            // tells it from a letter it keeps.
            anchor: () => assertStructurallySame(readmeNodes(href)([['heading', 1, [['text', 'أ،ب']]]]),
                error('a heading character whose anchor GitHub may make otherwise: أ')),
        },
    },
    readmeSection: {
        rendered: () => assertStructurallySame(readmeSection('f')(ok([['p', 'a']])), [['article', { 'data-readme': '' }, ['p', 'a']]]),
        refused: () => assertStructurallySame(readmeSection('f')(error('line 1: a table')),
            [['p', { 'data-readme-refused': '' }, ['a', { href: 'f' }, 'README.md'], ' is not rendered here: line 1: a table.']]),
    },
}
