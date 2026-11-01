/**
 * Proofs for a README as the top of its page.
 *
 * @import { Blocks } from '../../media/markdown/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 */

import { linkedHeading } from '../permalink/module.f.js'
import { codeBlock } from '../demo/code/module.f.js'
import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { anchors, readmeName, readmeNodes, readmeSection, resolveHref, slug } from './module.f.mjs'

/** Pages for the root, `spec` and `spec/a`, and none for anything else. @type {(path: string) => boolean} */
const isPage = path => path === '.' || path === 'spec' || path === 'spec/a'

/** Links from `spec/a`'s README, in a build with no commit. */
const local = resolveHref(null)(isPage)('spec/a')

/** A fence as the page draws it: a code block that copies `text`. @type {(text: string, code: Element) => Element} */
const fence = (text, code) => codeBlock(text, 'Copy code', [code])

/** A link refused for a target named `bad`, and every other kept. */
const href = (/** @type {string} */ h) => h === 'bad' ? error('no') : ok(h)

export const proof = /** @type {const} */ ({
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
        spans: () => assertEq(slug([['code', 'a_b'], ['text', ' – '], ['link', [['text', 'C'], ['code', 'd']], 'u'], ['em', [['text', 'É']]]]), 'a_b--cdé'),
        // An uncased script stays, as GitHub keeps it; its punctuation, a
        // symbol and an emoji go.
        uncased: () => assertEq(slug([['text', '中文、テスト → ok ✓ 😀 한 a×b§']]), '中文テスト--ok---한-ab'),
        // A character it cannot class is left out of the slug; the README
        // is refused before the slug is used.
        unknown: () => assertEq(slug([['text', 'aأ']]), 'a'),
        // A Han ideograph past the first plane stays, as GitHub keeps it.
        supplementaryHan: () => assertEq(slug([['text', '𠀀 x']]), '𠀀-x'),
        kanaPunctuation: () => assertEq(slug([['text', 'ア・イ゛゠ー']]), 'アイー'),
        latin1Letters: () => assertEq(slug([['text', 'µ ª º']]), 'µ-ª-º'),
        // Past the emoji blocks, nothing is known to be dropped.
        legacySymbol: () => assertEq(slug([['text', 'a\u{1fb00}']]), 'a'),
        digits: () => assertEq(slug([['strong', [['text', '10-'], ['code', '2']]]]), '10-2'),
    },
    anchors: () => assertStructurallySame(
        anchors([['heading', 1, [['text', 'A']]], ['paragraph', []], ['heading', 2, [['text', 'a']]], ['heading', 2, [['text', 'B']]], ['heading', 3, [['text', 'A']]]]),
        ['a', 'a-1', 'b', 'a-2']),
    // A suffixed anchor a heading already has is not given again.
    anchorsSkipTaken: () => assertStructurallySame(
        anchors([['heading', 1, [['text', 'A']]], ['heading', 1, [['text', 'A-1']]], ['heading', 1, [['text', 'A']]]]),
        ['a', 'a-1', 'a-2']),
    reservedAnchors: () => assertStructurallySame(
        anchors([
            ['heading', 1, [['text', 'Demo']]],
            ['heading', 2, [['text', 'Demo']]],
            ['heading', 2, [['text', 'Emergent Testing']]],
            ['heading', 2, [['text', '!!!']]],
            ['heading', 2, [['text', 'Section']]],
            ['heading', 2, [['text', 'Demo-1']]],
            ['heading', 2, [['text', 'Drawer title']]],
        ]), ['demo-1', 'demo-2', 'emergent-testing-1', 'section', 'section-1', 'demo-1-1', 'drawer-title-1']),
    readmeNodes: {
        latin1Heading: () => assertStructurallySame(readmeNodes(href)([['heading', 1, [['text', 'µ ª º']]]]),
            ok([linkedHeading(2, 'µ-ª-º', 'µ ª º', ['µ ª º'])])),
        all: () => {
            /** @type {Blocks} */
            const blocks = [
                ['heading', 1, [['text', 'T']]],
                ['heading', 6, [['text', 'S']]],
                ['paragraph', [['text', 'a '], ['code', 'b'], ['strong', [['text', 'c'], ['code', 'h'], ['link', [['text', 'l']], 'm']]], ['em', [['text', 'd']]], ['link', [['text', 'e '], ['code', 'f']], 'g']]],
                ['code', 'js', 'x'],
                ['code', '', 'y'],
                ['list', false, [[['paragraph', [['text', 'i']]], ['list', true, [[['paragraph', [['text', 'k']]]]]]], [['paragraph', [['text', 'j']]]]]],
                ['table', [null, 'center'], [[['text', 'h']], []], [[[['code', 'c']], [['text', 'd']]]]],
                ['table', ['left'], [[['text', 'h']]], []],
                ['olist', 1, false, [[['paragraph', [['text', 'm']]]]]],
                ['olist', 3, true, [[['paragraph', [['text', 'n']]]]]],
                ['list', false, [[['task', true], ['paragraph', [['text', 'o']]]], [['task', false], ['paragraph', [['text', 'p']]]]]],
                ['list', true, [[['task', false], ['paragraph', [['text', 'q']]], ['paragraph', [['text', 'r']]]]]],
                ['quote', [['paragraph', [['text', 'u']]], ['list', false, [[['paragraph', [['text', 'v']]]]]]]],
                ['list', false, [[['quote', [['paragraph', [['text', 'w']]]]]]]],
            ]
            assertStructurallySame(readmeNodes(href)(blocks), ok([
                linkedHeading(2, 't', 'T', ['T']),
                linkedHeading(6, 's', 'S', ['S']),
                ['p', 'a ', ['code', 'b'], ['strong', 'c', ['code', 'h'], ['a', { href: 'm' }, 'l']], ['em', 'd'], ['a', { href: 'g' }, 'e ', ['code', 'f']]],
                fence('x', ['code', { class: 'language-js' }, ['span', { 'data-token': 'identifier' }, 'x']]),
                fence('y', ['code', 'y']),
                ['ul', ['li', 'i', ['ul', ['li', ['p', 'k']]]], ['li', 'j']],
                ['table', ['thead', ['tr', ['th', 'h'], ['th', { align: 'center' }]]], ['tbody', ['tr', ['td', ['code', 'c']], ['td', { align: 'center' }, 'd']]]],
                ['table', ['thead', ['tr', ['th', { align: 'left' }, 'h']]]],
                ['ol', ['li', 'm']],
                ['ol', { start: '3' }, ['li', ['p', 'n']]],
                ['ul', ['li', { class: 'task-list-item' }, ['input', { type: 'checkbox', disabled: '', checked: '' }], ' ', 'o'],
                    ['li', { class: 'task-list-item' }, ['input', { type: 'checkbox', disabled: '' }], ' ', 'p']],
                ['ul', ['li', { class: 'task-list-item' }, ['p', ['input', { type: 'checkbox', disabled: '' }], ' ', 'q'], ['p', 'r']]],
                // A quote's paragraph is a `p`, in a tight list's item too.
                ['blockquote', ['p', 'u'], ['ul', ['li', 'v']]],
                ['ul', ['li', ['blockquote', ['p', 'w']]]],
            ]))
        },
        // A link inside bold is placed as any link is, or refused.
        strongLinkRefusal: () => assertStructurallySame(readmeNodes(href)([['paragraph', [['strong', [['link', [['text', 'x']], 'bad']]]]]]), error('no')),
        quoteRefusal: () => assertStructurallySame(readmeNodes(href)([['quote', [['paragraph', [['link', [['text', 'x']], 'bad']]]]]]), error('no')),
        // A fence the tokenizer reads is coloured, in any case of its
        // language's name; any other stays its text.
        fences: {
            // The copy leaves out the newline that ends the fence's last line.
            js: () => assertStructurallySame(readmeNodes(href)([['code', 'JavaScript', 'const a = 1 // b\n']]), ok([
                fence('const a = 1 // b', ['code', { class: 'language-JavaScript' },
                    ['span', { 'data-token': 'keyword' }, 'const'], ' ',
                    ['span', { 'data-token': 'identifier' }, 'a'], ' = ',
                    ['span', { 'data-token': 'number' }, '1'], ' ',
                    ['span', { 'data-token': 'comment' }, '// b'], '\n']),
            ])),
            json: () => assertStructurallySame(readmeNodes(href)([['code', 'json', '{"a":true}']]), ok([
                fence('{"a":true}', ['code', { class: 'language-json' },
                    '{', ['span', { 'data-token': 'string' }, '"a"'], ':', ['span', { 'data-token': 'literal' }, 'true'], '}']),
            ])),
            // TypeScript's own keywords, where an operand follows them.
            ts: () => assertStructurallySame(readmeNodes(href)([['code', 'ts', 'type A = { type: 1 }']]), ok([
                fence('type A = { type: 1 }', ['code', { class: 'language-ts' },
                    ['span', { 'data-token': 'keyword' }, 'type'], ' ',
                    ['span', { 'data-token': 'identifier' }, 'A'], ' = { ',
                    ['span', { 'data-token': 'identifier' }, 'type'], ': ',
                    ['span', { 'data-token': 'number' }, '1'], ' }']),
            ])),
            // A flowchart is drawn; a Mermaid fence the site cannot draw
            // stays its source.
            mermaid: () => {
                const r = readmeNodes(href)([['code', 'mermaid', 'flowchart LR\na --> b\n']])
                assertStructurallySame(r[0] === 'ok' ? r[1][0].slice(0, 2) : null, ['div', { 'data-graph': '' }])
            },
            mermaidSource: () => assertStructurallySame(readmeNodes(href)([['code', 'mermaid', 'pie\n']]),
                ok([fence('pie', ['code', { class: 'language-mermaid' }, 'pie\n'])])),
            mermaidKeywords: () => {
                for (const name of ['classDef', 'class', 'style', 'subgraph']) {
                    const text = `flowchart LR\n${name} --> b`
                    assertStructurallySame(readmeNodes(href)([['code', 'mermaid', text]]),
                        ok([fence(text, ['code', { class: 'language-mermaid' }, text])]))
                }
            },
            mermaidEdgeDelimiters: () => {
                for (const label of ['f(x)', 'f[x]', 'f{x}']) {
                    const text = `flowchart LR\na -->|${label}| b`
                    assertStructurallySame(readmeNodes(href)([['code', 'mermaid', text]]),
                        ok([fence(text, ['code', { class: 'language-mermaid' }, text])]))
                }
            },
            other: () => assertStructurallySame(readmeNodes(href)([['code', 'rust', 'let a = 1;']]),
                ok([fence('let a = 1;', ['code', { class: 'language-rust' }, 'let a = 1;'])])),
            // Text the tokenizer refuses is not partly coloured.
            refused: () => assertStructurallySame(readmeNodes(href)([['code', 'js', 'a …']]),
                ok([fence('a …', ['code', { class: 'language-js' }, 'a …'])])),
            empty: () => assertStructurallySame(readmeNodes(href)([['code', 'js', '']]),
                ok([fence('', ['code', { class: 'language-js' }])])),
        },
        // An image draws from an https source, alone or as a link's label.
        images: () => assertStructurallySame(readmeNodes(href)([['paragraph', [
            ['image', 'a', 'HTTPS://e.x/b.png'],
            ['link', [['image', 'c', 'https://e.x/d.svg'], ['text', ' e']], 'f'],
        ]]]), ok([['p', ['img', { src: 'HTTPS://e.x/b.png', alt: 'a' }], ['a', { href: 'f' }, ['img', { src: 'https://e.x/d.svg', alt: 'c' }], ' e']]])),
        // A link it cannot place refuses the README, wherever it stands.
        refuses: {
            letterlike: () => assertStructurallySame(readmeNodes(href)([['heading', 1, [['text', 'ℂ']]]]),
                error('a heading character whose anchor GitHub may make otherwise: ℂ')),
            heading: () => assertStructurallySame(readmeNodes(href)([['heading', 1, [['link', [['text', 'x']], 'bad']]]]), error('no')),
            // GitHub serves these itself; a page cannot load them as it does.
            relativeImage: () => assertStructurallySame(readmeNodes(href)([['paragraph', [['image', 'a', './b.png']]]]),
                error('an image whose source is not an https address: ./b.png')),
            httpBadge: () => assertStructurallySame(readmeNodes(href)([['paragraph', [['link', [['image', 'a', 'http://e.x/b.svg']], 'c']]]]),
                error('an image whose source is not an https address: http://e.x/b.svg')),
            imageInAHeading: () => assertStructurallySame(readmeNodes(href)([['heading', 1, [['text', 'a '], ['image', 'b', 'https://e.x/c.png']]]]),
                error('an image in a heading, whose anchor GitHub may make otherwise')),
            badgeInAHeading: () => assertStructurallySame(readmeNodes(href)([['heading', 1, [['link', [['image', 'b', 'https://e.x/c.png']], 'd']]]]),
                error('an image in a heading, whose anchor GitHub may make otherwise')),
            paragraph: () => assertStructurallySame(readmeNodes(href)([['paragraph', [['text', 'a'], ['link', [['text', 'x']], 'bad']]]]), error('no')),
            list: () => assertStructurallySame(readmeNodes(href)([['list', false, [[['paragraph', [['link', [['text', 'x']], 'bad']]]]]]]), error('no')),
            header: () => assertStructurallySame(readmeNodes(href)([['table', [null], [[['link', [['text', 'x']], 'bad']]], []]]), error('no')),
            row: () => assertStructurallySame(readmeNodes(href)([['table', [null], [[]], [[[['link', [['text', 'x']], 'bad']]]]]]), error('no')),
            // An Arabic comma is punctuation GitHub drops, and nothing here
            // tells it from a letter it keeps.
            anchor: () => assertStructurallySame(readmeNodes(href)([['heading', 1, [['text', 'أ،ب']]]]),
                error('a heading character whose anchor GitHub may make otherwise: أ')),
            // `İ` is a cased letter, but its lowercase holds a combining dot.
            lowercase: () => assertStructurallySame(readmeNodes(href)([['heading', 1, [['text', 'İ']]]]),
                error('a heading character whose anchor GitHub may make otherwise: \u0307')),
        },
    },
    readmeSection: {
        rendered: () => assertStructurallySame(readmeSection('f')(ok([['p', 'a']])), [['article', { 'data-readme': '' }, ['p', 'a']]]),
        refused: () => assertStructurallySame(readmeSection('f')(error('line 1: a table')),
            [['p', { 'data-readme-refused': '' }, ['a', { href: 'f' }, 'README.md'], ' is not rendered here: line 1: a table.']]),
    },
})
