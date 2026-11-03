/**
 * @import { Element } from './types.ts'
 */

import { htmlToString, htmlUtf8, isRawText, isVoidTag, pageRefusal, parseElement, rawTextContent, scriptRefusal, textContent } from "./module.f.mjs"
import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { utf8ToString } from '../../text/utf8/module.f.mjs'

export const proof = {
    // What a page could not read as written, or would run, is refused with
    // its reason; anything else is not.
    pageRefusal: {
        plain: () => assertEq(pageRefusal(['div', { 'data-x': 'a', 'xlink:href': '#', 'aria-label': 'b' }, 'text', ['svg', ['foreignObject', ['p', 'x']]]]), null),
        script: () => assertEq(pageRefusal(['script', 'x']), scriptRefusal),
        nested: () => assertEq(pageRefusal(['div', { id: 'a' }, 'text', ['p', ['script']]]), scriptRefusal),
        // A browser reads a tag name in any case, in an `svg` as well.
        anyCase: () => assertEq(pageRefusal(['SCRIPT', 'x']), scriptRefusal),
        anyCaseInSvg: () => assertEq(pageRefusal(['svg', ['ScRiPt', 'x']]), scriptRefusal),
        // A parser ends a tag name at whitespace, `/` and `>`.
        tagWithSpace: () => assertEq(pageRefusal(['script ', 'x']),
            "media/html: the tag 'script ' is not a plain name: a page would read other markup"),
        tagWithSlash: () => assertEq(pageRefusal(['div', ['script/x']]),
            "media/html: the tag 'script/x' is not a plain name: a page would read other markup"),
        emptyTag: () => assertEq(pageRefusal(['']),
            "media/html: the tag '' is not a plain name: a page would read other markup"),
        tagStartingWithDigit: () => assertEq(pageRefusal(['1a']),
            "media/html: the tag '1a' is not a plain name: a page would read other markup"),
        // An attribute name that would close the tag and open a script.
        attribute: () => assertEq(pageRefusal(['div', { 'x><script>alert(1)</script': '' }]),
            "media/html: the attribute 'x><script>alert(1)</script' is not a plain name: a page would read other markup"),
        // An attribute left undefined is not written, so its name is not read.
        undefinedAttribute: () => assertEq(pageRefusal(['div', { 'a b': undefined }]), null),
        // The serializer writes an uppercase `BR`'s children, so they count.
        underUppercaseVoid: () => assertEq(pageRefusal(/** @type {Element} */ (['BR', ['script']])), scriptRefusal),
        underVoid: () => assertEq(pageRefusal(/** @type {Element} */ (['br', ['script']])), null),
        underRawText: () => assertEq(pageRefusal(['style', ['script']]), null),
    },
    // A document names its language on the root element, which is the only
    // place WCAG 3.1.1 looks for it.
    document: () => assertEq(
        utf8ToString(htmlUtf8('uk')(['title', 'Сторінка'])(['h1', 'Привіт'])),
        '<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8">'
            + '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
            + '<title>Сторінка</title></head><body><h1>Привіт</h1></body></html>'),
    empty: () => {
        const r = htmlToString(['html'])
        assertEq(r, '<!DOCTYPE html><html></html>')
    },
    empty2: () => {
        const r = htmlToString(['html'])
        assertEq(r, '<!DOCTYPE html><html></html>')
    },
    void: () => {
        const r = htmlToString(['area'])
        assertEq(r, '<!DOCTYPE html><area>')
    },
    some: () => {
        /** @type {Element} */
        const x
            = ['div', {}, '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = htmlToString(x)
        assertEq(s, '<!DOCTYPE html><div>&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>')
    },
    some2: () => {
        /** @type {Element} */
        const x
            = ['div', '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = htmlToString(x)
        assertEq(s, '<!DOCTYPE html><div>&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>')
    },
    someVoid: () => {
        /** @type {Element} */
        const x
            = ['div', ['br', {id: '5'}], '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = htmlToString(x)
        assertEq(s, '<!DOCTYPE html><div><br id="5">&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>')
    },
    raw: {
        script: () => {
            /** @type {Element} */
            const x = ['script', {id: 'a<'}, 'const a = ',  'a<b>c']
            const s = htmlToString(x)
            assertEq(s, '<!DOCTYPE html><script id="a&lt;">const a = a<b>c</script>')
        },
        scriptEsc: () => {
            /** @type {Element} */
            const x = ['script', {id: 'a<'}, '<',  '/script>']
            const s = htmlToString(x)
            assertEq(s, '<!DOCTYPE html><script id="a&lt;"><\\/script></script>')
        },
        style: () => {
            /** @type {Element} */
            const x = ['style', {id: 'a<'}, 'const a = ',  'a<b>c']
            const s = htmlToString(x)
            assertEq(s, '<!DOCTYPE html><style id="a&lt;">const a = a<b>c</style>')
        },
        styleEsc: () => {
            /** @type {Element} */
            const x = ['style', {id: 'a<'}, '</',  'stYle>']
            const s = htmlToString(x)
            assertEq(s, '<!DOCTYPE html><style id="a&lt;"><\\/stYle></style>')
        },
        noRaw: () => {
            /** @type {Element} */
            const x = ['div', {id: 'a<'}, 'const a = ',  'a<b>c']
            const s = htmlToString(x)
            assertEq(s, '<!DOCTYPE html><div id="a&lt;">const a = a&lt;b&gt;c</div>')
        },
        elemChild: () => {
            /** @type {Element} */
            const x = ['script', ['span', 'ignored'], 'visible']
            const s = htmlToString(x)
            assertEq(s, '<!DOCTYPE html><script>visible</script>')
        },
    },
    // The helpers the DOM renderer shares, so both read an element alike.
    parseElement: {
        bare: () => assertStructurallySame(parseElement(['br']), ['br', {}, []]),
        attributes: () => assertStructurallySame(
            parseElement(['a', { href: 'x' }, 'y']), ['a', { href: 'x' }, ['y']]),
        children: () => assertStructurallySame(
            parseElement(['p', 'a', ['b']]), ['p', {}, ['a', ['b']]]),
    },
    isVoidTag: () => {
        assertEq(isVoidTag('br'), true)
        assertEq(isVoidTag('div'), false)
    },
    isRawText: () => {
        assertEq(isRawText('style'), true)
        assertEq(isRawText('div'), false)
    },
    textContent: () => assertEq(textContent(['p', 'a ', ['a', { href: 'x' }, 'b', ['img', { alt: 'c' }]], ' d']), 'a b d'),
    rawTextContent: () => assertEq(rawTextContent(['a', ['b', 'x'], '</c']), 'a<\\/c'),
}
