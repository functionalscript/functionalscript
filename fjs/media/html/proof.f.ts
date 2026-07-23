import { htmlToString, type Element } from "./module.f.ts"
import { assertEq } from '../../asserts/module.f.ts'

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
        const x
            : Element
            = ['div', {}, '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = htmlToString(x)
        assertEq(s, '<!DOCTYPE html><div>&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>')
    },
    some2: () => {
        const x
            : Element
            = ['div', '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = htmlToString(x)
        assertEq(s, '<!DOCTYPE html><div>&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>')
    },
    someVoid: () => {
        const x
            : Element
            = ['div', ['br', {id: '5'}], '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = htmlToString(x)
        assertEq(s, '<!DOCTYPE html><div><br id="5">&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>')
    },
    raw: {
        script: () => {
            const x: Element = ['script', {id: 'a<'}, 'const a = ',  'a<b>c']
            const s = htmlToString(x)
            assertEq(s, '<!DOCTYPE html><script id="a&lt;">const a = a<b>c</script>')
        },
        scriptEsc: () => {
            const x: Element = ['script', {id: 'a<'}, '<',  '/script>']
            const s = htmlToString(x)
            assertEq(s, '<!DOCTYPE html><script id="a&lt;"><\\/script></script>')
        },
        style: () => {
            const x: Element = ['style', {id: 'a<'}, 'const a = ',  'a<b>c']
            const s = htmlToString(x)
            assertEq(s, '<!DOCTYPE html><style id="a&lt;">const a = a<b>c</style>')
        },
        styleEsc: () => {
            const x: Element = ['style', {id: 'a<'}, '</',  'stYle>']
            const s = htmlToString(x)
            assertEq(s, '<!DOCTYPE html><style id="a&lt;"><\\/stYle></style>')
        },
        noRaw: () => {
            const x: Element = ['div', {id: 'a<'}, 'const a = ',  'a<b>c']
            const s = htmlToString(x)
            assertEq(s, '<!DOCTYPE html><div id="a&lt;">const a = a&lt;b&gt;c</div>')
        },
        elemChild: () => {
            const x: Element = ['script', ['span', 'ignored'], 'visible']
            const s = htmlToString(x)
            assertEq(s, '<!DOCTYPE html><script>visible</script>')
        },
    }
}
