# JSON to HTML

```json
{
    "a": 34.5,
    "b": true,
    "c": [null]
}
```

```js
['pre',
    [
        '\n',
        ['span',{class:'symbol'},['{']],
        '\n    ',
        ['span',{class:'string'},['"a"']],
        ['span',{class:'symbol'},[':']],
        ' ',
        ['span',{class:'number'},['34.5']],
        ['span',{class:'symbol'},[',']],
        '\n    ',
        ['span',{class:'string'},['"b"']],
        ['span',{class:'symbol'},[':']],
        ' ',
        ['span',{class:'bool'},['true']],
        ['span',{class:'symbol'},[',']],
        '\n    ',
        ['span',{class:'string'},['"c"']],
        ['span',{class:'symbol'},[':']],
        ' ',
        ['span',{class:'symbol'},['[']],
        ['span',{class:'null'},['null']],
        ['span',{class:'symbol'},[']']],
        ['span',{class:'symbol'},[',']],
        '\n    ',
        ['span',{class:'symbol'},['}']],
        '\n'
    ]
]
```

```html
<pre>
<span class="symbol">{</span>
    <span class="string">"a"<span><span class="symbol">:</span> <span class="number">34.5</span><span class="symbol">,<span>
    <span class="string">"b"<span><span class="symbol">:</span> <span class="bool">true</span><span class="symbol">,<span>
    <span class="string">"c"<span><span class="symbol">:</span> <span class="symbol">[</span><span class="null">null</span><span class="symbol">]</span>
</pre>
```
