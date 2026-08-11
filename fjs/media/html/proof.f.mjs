import { htmlToString } from "./module.f.mjs"
/** @import { Element } from './types.ts' */
import { assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    empty: () => {
        const r = htmlToString(['html'])
        if (r !== '<!DOCTYPE html><html></html>') { throw `empty: ${r}` }
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
    }
}
