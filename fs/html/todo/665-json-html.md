## 665-json-html. JSON to HTML syntax highlighter

**Priority:** P3
**Status:** open

### Problem

There is no way to render a JSON value as syntax-highlighted HTML. A JSON viewer
(in a browser, in docs, in a tool UI) needs each token class — strings, numbers,
booleans, null, structural symbols — wrapped in a `<span>` so CSS can colour it.

### Proposal

A module `fs/json/html/module.f.ts` that converts a JSON `Unknown` value to a
syntax-highlighted HTML representation, using the project's existing virtual-DOM
format (`['tag', {attrs}, ...children]`).

#### Intermediate virtual-DOM form

Given the JSON value:

```json
{
    "a": 34.5,
    "b": true,
    "c": [null]
}
```

The converter produces a virtual-DOM tree:

```js
['pre',
    '\n',
    ['span', {class:'symbol'}, '{'],
    '\n    ',
    ['span', {class:'string'}, '"a"'],
    ['span', {class:'symbol'}, ':'],
    ' ',
    ['span', {class:'number'}, '34.5'],
    ['span', {class:'symbol'}, ','],
    '\n    ',
    ['span', {class:'string'}, '"b"'],
    ['span', {class:'symbol'}, ':'],
    ' ',
    ['span', {class:'bool'}, 'true'],
    ['span', {class:'symbol'}, ','],
    '\n    ',
    ['span', {class:'string'}, '"c"'],
    ['span', {class:'symbol'}, ':'],
    ' ',
    ['span', {class:'symbol'}, '['],
    ['span', {class:'null'}, 'null'],
    ['span', {class:'symbol'}, ']'],
    '\n',
    ['span', {class:'symbol'}, '}'],
    '\n'
]
```

Which serialises to:

```html
<pre>
<span class="symbol">{</span>
    <span class="string">"a"</span><span class="symbol">:</span> <span class="number">34.5</span><span class="symbol">,</span>
    <span class="string">"b"</span><span class="symbol">:</span> <span class="bool">true</span><span class="symbol">,</span>
    <span class="string">"c"</span><span class="symbol">:</span> <span class="symbol">[</span><span class="null">null</span><span class="symbol">]</span>
</pre>
```

#### CSS classes

| Class | Covers |
|-------|--------|
| `symbol` | `{`, `}`, `[`, `]`, `:`, `,` |
| `string` | quoted string keys and values |
| `number` | numeric values |
| `bool` | `true`, `false` |
| `null` | `null` |

### Tasks

- [ ] `fs/json/html/module.f.ts` — `toHtml(value: Unknown): VDom` converter
- [ ] `proof.f.ts` covering each value type and a nested example
- [ ] Register in `deno.json` exports

### Related

- `fs/json/module.f.ts` — the `Unknown` type and `serialize`
- `fs/json/schema/module.f.ts` — sibling JSON-dialect module
