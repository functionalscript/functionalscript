import { htmlToString, type Element } from "./module.f.ts"
import { assert } from '../../asserts/module.f.ts'

export const proof = {
    empty: () => {
        const r = htmlToString(['html'])
        if (r !== '<!DOCTYPE html><html></html>') { throw `empty: ${r}` }
    },
    empty2: () => {
        const r = htmlToString(['html'])
        assert(r === '<!DOCTYPE html><html></html>', r)
    },
    void: () => {
        const r = htmlToString(['area'])
        assert(r === '<!DOCTYPE html><area>', r)
    },
    some: () => {
        const x
            : Element
            = ['div', {}, '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = htmlToString(x)
        assert(s === '<!DOCTYPE html><div>&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>', s)
    },
    some2: () => {
        const x
            : Element
            = ['div', '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = htmlToString(x)
        assert(s === '<!DOCTYPE html><div>&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>', s)
    },
    someVoid: () => {
        const x
            : Element
            = ['div', ['br', {id: '5'}], '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = htmlToString(x)
        assert(s === '<!DOCTYPE html><div><br id="5">&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>', s)
    },
    raw: {
        script: () => {
            const x: Element = ['script', {id: 'a<'}, 'const a = ',  'a<b>c']
            const s = htmlToString(x)
            assert(s === '<!DOCTYPE html><script id="a&lt;">const a = a<b>c</script>', s)
        },
        scriptEsc: () => {
            const x: Element = ['script', {id: 'a<'}, '<',  '/script>']
            const s = htmlToString(x)
            assert(s === '<!DOCTYPE html><script id="a&lt;"><\\/script></script>', s)
        },
        style: () => {
            const x: Element = ['style', {id: 'a<'}, 'const a = ',  'a<b>c']
            const s = htmlToString(x)
            assert(s === '<!DOCTYPE html><style id="a&lt;">const a = a<b>c</style>', s)
        },
        styleEsc: () => {
            const x: Element = ['style', {id: 'a<'}, '</',  'stYle>']
            const s = htmlToString(x)
            assert(s === '<!DOCTYPE html><style id="a&lt;"><\\/stYle></style>', s)
        },
        noRaw: () => {
            const x: Element = ['div', {id: 'a<'}, 'const a = ',  'a<b>c']
            const s = htmlToString(x)
            assert(s === '<!DOCTYPE html><div id="a&lt;">const a = a&lt;b&gt;c</div>', s)
        },
        elemChild: () => {
            const x: Element = ['script', ['span', 'ignored'], 'visible']
            const s = htmlToString(x)
            assert(s === '<!DOCTYPE html><script>visible</script>', s)
        },
    }
}
