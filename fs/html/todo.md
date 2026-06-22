# 665-json-html. JSON to HTML syntax highlighter

**Priority:** P3
**Status:** open

## Problem

There is no way to render a JSON value as syntax-highlighted HTML. A JSON viewer
(in a browser, in docs, in a tool UI) needs each token class — strings, numbers,
booleans, null, structural symbols — wrapped in a `<span>` so CSS can colour it.

## Proposal

A module `fs/json/html/module.f.ts` that converts a JSON `Unknown` value to a
syntax-highlighted HTML representation, using the project's existing virtual-DOM
format (`['tag', {attrs}, ...children]`).

### Intermediate virtual-DOM form

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

### CSS classes

| Class | Covers |
|-------|--------|
| `symbol` | `{`, `}`, `[`, `]`, `:`, `,` |
| `string` | quoted string keys and values |
| `number` | numeric values |
| `bool` | `true`, `false` |
| `null` | `null` |

## Tasks

- [ ] `fs/json/html/module.f.ts` — `toHtml(value: Unknown): VDom` converter
- [ ] `proof.f.ts` covering each value type and a nested example
- [ ] Register in `deno.json` exports

## Related

- `fs/json/module.f.ts` — the `Unknown` type and `serialize`
- `fs/json/schema/module.f.ts` — sibling JSON-dialect module

---

# 66N-html-escape-table. Make HTML character escaping a declarative table

**Priority:** P4
**Status:** open

## Problem

`fs/html/module.f.ts` escapes the four HTML-significant characters with a hand-written
`switch` whose arms map a code point to its entity, falling back to the literal
character:

```ts
// fs/html/module.f.ts:71-79
const escapeCharCode = (code: number) => {
    switch (code) {
        case quotationMark: return '&quot;'
        case ampersand: return '&amp;'
        case lessThanSign: return '&lt;'
        case greaterThanSign: return '&gt;'
        default: return fromCharCode(code)
    }
}
```

This is precisely the imperative-dispatch shape that `AGENTS.md` asks us to prefer
*against*:

> **Prefer declarative style over imperative.** … favor data-driven definitions
> (metadata + … together in an array or registry) over imperative switch
> statements or hardcoded conditionals.

The mapping `code point → entity` is plain data — a four-row lookup table — but here
it is expressed as control flow. The `default` arm additionally mixes the *fallback
policy* ("anything not in the table passes through unescaped") into the same `switch`
as the table itself, so the two concerns (what the escape set is, and what to do with
characters outside it) are not separable.

The codebase already treats this exact pattern as worth converting elsewhere:

- [i65Z-asn1-tag-codec-table](./65Z-asn1-tag-codec-table.md) — replace a tag/codec
  `switch` with a data table.
- [i667-js-tokenizer-handler-literals](./667-js-tokenizer-handler-literals.md) — the
  five `\b \f \n \r \t` escape handlers "differ only in emitted char" and should
  become an `escapeTo` table.

The HTML escaper is the same shape and is currently the odd one out.

## Proposal

Lift the escape set into a data table keyed by code point, and reduce
`escapeCharCode` to a single table lookup with the pass-through fallback expressed
once:

```ts
// the escape set as data — one row per escaped character
const escapeTable = {
    [quotationMark]: '&quot;',
    [ampersand]: '&amp;',
    [lessThanSign]: '&lt;',
    [greaterThanSign]: '&gt;',
} as const

const escapeCharCode = (code: number): string =>
    escapeTable[code] ?? fromCharCode(code)
```

Now the escape set is a value that can be read, extended, or shared without touching
control flow: adding (say) `&#x27;` for `'` is a new row, not a new `case`. The
fallback policy ("not in the table ⇒ emit the raw character") appears exactly once, in
`escapeCharCode`, separated from the table that defines *what* is escaped. `escape`
(`:81`), `attribute` (`:96-97`) and every downstream consumer are unchanged because
`escapeCharCode`'s signature is identical.

### Notes / things to confirm during implementation

- The `escapeTable` keys come from the `ascii` module constants
  (`quotationMark`, `ampersand`, `lessThanSign`, `greaterThanSign`), which are typed
  `number` (not literal). A computed-key object literal over `number` keys yields a
  numeric index signature, so `escapeTable[code]` type-checks for an arbitrary `code`.
  The object literal needs its type pinned per `AGENTS.md` (the literal-`const` rule):
  `as const` as shown, or an explicit annotation if `as const` interacts badly with the
  numeric-index inference — pick whichever `npx tsc` accepts without an `as` cast.
- The behaviour is byte-for-byte identical; `fs/html/proof.f.ts` should pass unchanged
  and must still cover both the "escaped" and "pass-through" outcomes (the `??` arms).

## Tasks

- [ ] Replace the `escapeCharCode` `switch` in `fs/html/module.f.ts` with an
      `escapeTable` lookup plus the `?? fromCharCode(code)` fallback.
- [ ] Confirm the table-literal type pins correctly without an `as` cast; run
      `npx tsc`.
- [ ] Run `fjs t`; confirm `fs/html/proof.f.ts` still passes with full line/branch
      coverage (both the escaped and pass-through branches exercised).

## Related

- [i65Z-asn1-tag-codec-table](./65Z-asn1-tag-codec-table.md) — same switch→table move
  in `fs/asn.1`.
- [i667-js-tokenizer-handler-literals](./667-js-tokenizer-handler-literals.md) — the
  tokenizer's escape handlers, same "table of char→string" shape.

---

