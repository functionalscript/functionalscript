const _ = require('./index.f.js')

{
    const r = _.htmlToString(['html', []])
    if (r !== '<!DOCTYPE html><html></html>') { throw r }
}

{
    /** @type {_.Element} */
    const x = ['div', {}, ['<div>&amp;</div>', ['a', { href: 'hello"' }, []]]]
    const s = _.htmlToString(x)
    if (s !== '<!DOCTYPE html><div>&lt;div&gt;&amp;amp;&lt;/div&gt;<a href="hello&quot;"></a></div>') { throw s }
}