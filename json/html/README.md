# JSON to HTML

```json
{
    "a": 34.5,
    "b": true,
    "c": [null],
}
```

```js
['pre',
    [
        ['span',{class:'symbol'},['{']],
        '\n    ',
        ['span',{class:'string'},['"a"']],
        ['span',{class:'symbol'},[':']],
        ' ',
        ['span',{class:'number'},['34.5']],
        ',\n    ',
        ['span',{class:'string'},['"b"']],
        ['span',{class:'symbol'},[':']],
        ['span',{class:'bool'},['true']],
        ',\n    ',
        ['span',{class:'string'},['"c"']],
        ['span',{class:'symbol'},[':']],
        ['span',{class:'symbol'},['[']],
        ['span',{class:'string'},['null']],
        ['span',{class:'symbol'},[']']],
        ',\n    ',
        ['span',{class:'symbol'},['}']],
    ]
]
```

```html
```