import { htmlToString, type Element } from "./module.f.ts"

export default {
    empty: () => {
        const r = htmlToString(['html'])
        if (r !== '<!DOCTYPE html><html></html>') { throw `empty: ${r}` }
    },
    empty2: () => {
        const r = htmlToString(['html'])
        if (r !== '<!DOCTYPE html><html></html>') { throw r }
    },
    void: () => {
        const r = htmlToString(['area'])
        if (r !== '<!DOCTYPE html><area>') { throw r }
    },
    some: () => {
        const x
            : Element
            = ['div', {}, '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = htmlToString(x)
        if (s !== '<!DOCTYPE html><div>&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>') { throw s }
    },
    some2: () => {
        const x
            : Element
            = ['div', '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = htmlToString(x)
        if (s !== '<!DOCTYPE html><div>&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>') { throw s }
    },
    someVoid: () => {
        const x
            : Element
            = ['div', ['br', {id: '5'}], '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = htmlToString(x)
        if (s !== '<!DOCTYPE html><div><br id="5">&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>') { throw s }
    },
    raw: {
        script: () => {
            const x: Element = ['script', {id: 'a<'}, 'const a = ',  'a<b>c']
            const s = htmlToString(x)
            if (s !== '<!DOCTYPE html><script id="a&lt;">const a = a<b>c</script>') { throw s }
        },
        scriptEsc: () => {
            const x: Element = ['script', {id: 'a<'}, '<',  '/script>']
            const s = htmlToString(x)
            if (s !== '<!DOCTYPE html><script id="a&lt;"><\\/script></script>') { throw s }
        },
        style: () => {
            const x: Element = ['style', {id: 'a<'}, 'const a = ',  'a<b>c']
            const s = htmlToString(x)
            if (s !== '<!DOCTYPE html><style id="a&lt;">const a = a<b>c</style>') { throw s }
        },
        styleEsc: () => {
            const x: Element = ['style', {id: 'a<'}, '</',  'stYle>']
            const s = htmlToString(x)
            if (s !== '<!DOCTYPE html><style id="a&lt;"><\\/stYle></style>') { throw s }
        },
        noRaw: () => {
            const x: Element = ['div', {id: 'a<'}, 'const a = ',  'a<b>c']
            const s = htmlToString(x)
            if (s !== '<!DOCTYPE html><div id="a&lt;">const a = a&lt;b&gt;c</div>') { throw s }
        },
    }
}
