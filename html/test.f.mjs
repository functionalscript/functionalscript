import * as _ from './module.f.mjs'

export default {
    empty: () => {
        const r = _.htmlToString(['html'])
        if (r !== '<!DOCTYPE html><html></html>') { throw `empty: ${r}` }
    },
    empty2: () => {
        const r = _.htmlToString(['html'])
        if (r !== '<!DOCTYPE html><html></html>') { throw r }
    },
    void: () => {
        const r = _.htmlToString(['area'])
        if (r !== '<!DOCTYPE html><area>') { throw r }
    },
    some: () => {
        /** @type {_.Element} */
        const x = ['div', {}, '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = _.htmlToString(x)
        if (s !== '<!DOCTYPE html><div>&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>') { throw s }
    },
    some2: () => {
        /** @type {_.Element} */
        const x = ['div', '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = _.htmlToString(x)
        if (s !== '<!DOCTYPE html><div>&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>') { throw s }
    },
    someVoid: () => {
        /** @type {_.Element} */
        const x = ['div', ['br', {id: '5'}], '<div>&amp;</div>', ['a', { href: 'hello"' }]]
        const s = _.htmlToString(x)
        if (s !== '<!DOCTYPE html><div><br id="5">&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>') { throw s }
    }
}
