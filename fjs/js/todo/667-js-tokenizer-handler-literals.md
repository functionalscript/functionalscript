## 667-js-tokenizer-handler-literals. `js/tokenizer`: name the repeated token-emitting shapes in the number/escape handlers

**Priority:** P4
**Status:** open

### Problem

The number- and escape-state handlers in `fjs/js/tokenizer/module.f.mjs` repeat
the same token-emitting object literals, differing only in a constant (the next
`numberKind`, the `b` accumulator update, or the escaped character). The handler
*structure* is duplicated; only the data varies — exactly what DRY targets.

#### 1. `digit0ToToken` and `digit19ToToken` are the same function

`fjs/js/tokenizer/module.f.mjs:449-460` and `:463-474` are line-for-line
identical except for the `numberKind` in the `default` branch:

```ts
// digit0ToToken  (575)            default: … numberKind: state.numberKind }]   // :586
// digit19ToToken (590)            default: … numberKind: 'int' }]              // :601
```

Every other branch (`'0'`, `'.'`/`'fractional'`, `'e'`/`'e+'`/`'e-'`/`'expDigits'`)
is byte-identical. The two are registered side by side in `parseNumberStateOp`:

```ts
// fjs/js/tokenizer/module.f.mjs:538
rangeFunc<ParseNumberState>(one(digit0))(digit0ToToken),
rangeFunc<ParseNumberState>(rangeOneNine)(digit19ToToken),
```

They are *not* provably equivalent — the `default` diverges when `numberKind`
is `'bigint'` (`123n4`: `digit0` keeps `'bigint'`, `digit19` switches to
`'int'`) — so the merge must preserve that delta, not assume it away.

#### 2. The "continue a number token" literal appears ~9 times

The shape

```ts
[empty, { kind: 'number', value: appendChar(state.value)(input), b: <b>, numberKind: <k> }]
```

is written verbatim at `:570`, `:581`, `:585`, `:586`, `:596`, `:600`, `:601`,
`:611`, `:620`, `:629` — across `fullStopToToken`, both digit handlers,
`expToToken`, `hyphenMinusToToken`, and `plusSignToToken`. Only `<b>` and `<k>`
change; `kind`, `value: appendChar(state.value)(input)`, and the `[empty, …]`
envelope are constant noise repeated at every call site.

#### 3. The five `\b \f \n \r \t` escape handlers differ only in the output char

`fjs/js/tokenizer/module.f.mjs:577-580`:

```ts
rangeFunc<ParseEscapeCharState>(one(latinSmallLetterB))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(backspace) }]),
rangeFunc<ParseEscapeCharState>(one(latinSmallLetterF))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(ff) }]),
rangeFunc<ParseEscapeCharState>(one(latinSmallLetterN))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(lf) }]),
rangeFunc<ParseEscapeCharState>(one(latinSmallLetterR))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(cr) }]),
rangeFunc<ParseEscapeCharState>(one(latinSmallLetterT))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(ht) }]),
```

Five rows that map `(escape letter) → (emitted char)`; the handler body is
identical apart from the constant.

### Proposal

Hoist the repeated shapes to named module-scope helpers, parameterized by the
varying constant. All three are pure and capture no local state, so they belong
at module scope per `AGENTS.md`.

#### 1 + 2 — a `numberToken` constructor, and one `digitToToken` factory

The `numberKind` union and the `b` buffer shape are currently inline in
`ParseNumberState` (`fjs/js/tokenizer/types.ts:178-183`); name them
(`NumberKind`, `NumberBuffer`) when extracting so the helper signatures stay
precise:

```ts
const numberToken =
    (state: ParseNumberState) => (input: number) => (b: NumberBuffer) => (numberKind: NumberKind)
    : readonly[List<JsToken>, TokenizerState] =>
    [empty, { kind: 'number', value: appendChar(state.value)(input), b, numberKind }]
```

Then the digit handlers collapse to a single factory parameterized by the
`default`-branch kind, preserving the `'bigint'` delta exactly:

```ts
const digitToToken = (defaultKind: (state: ParseNumberState) => NumberKind) =>
    (state: ParseNumberState) => (input: number): readonly[List<JsToken>, TokenizerState] => {
        const t = numberToken(state)(input)
        switch (state.numberKind) {
            case '0': return tokenizeOp(input, { kind: 'invalidNumber' })
            case '.':
            case 'fractional': return t(addFracDigit(input)(state.b))('fractional')
            case 'e':
            case 'e+':
            case 'e-':
            case 'expDigits': return t(addExpDigit(input)(state.b))('expDigits')
            default: return t(addIntDigit(input)(state.b))(defaultKind(state))
        }
    }

const digit0ToToken = digitToToken(state => state.numberKind)
const digit19ToToken = digitToToken(() => 'int')
```

`fullStopToToken`, `expToToken`, `hyphenMinusToToken`, and `plusSignToToken`
likewise route their continuing branches through `numberToken`, dropping the
repeated `kind`/`value`/`[empty, …]` boilerplate.

#### 3 — a `(letter, char)` escape table — **done**

Landed, and wider than proposed here: the table lives in
[`fjs/js/string_escape`](../string_escape/module.f.mjs), shared with
`djs/tokenizer`'s decoder and the JSON serializer's encode side rather than
kept local to this module. `"`/`\`/`/` are not their own rows either — the
table pairs each with itself, so all eight simple escapes are one
`simpleEscapes.map(...)`, and only `u` → `unicodeChar` stays a hand-written row.

### Tasks

- [ ] Add `numberToken` and route the ~9 continuing-number literals through it.
- [ ] Replace `digit0ToToken`/`digit19ToToken` with one `digitToToken` factory,
      preserving the `'bigint'`-state `default` difference.
- [ ] Confirm `fjs/js/tokenizer` proof coverage still passes (`npm test`).

### Related

- [i157](../../djs/todo/157-json-djs-shared-value-machine.md) — shares the value layer above the
  tokenizer; this issue is purely internal to the JS lexer and independent.
- [i666-js-tokenizer-position-layer](./666-js-tokenizer-position-layer.md) —
  a separate concern (position/metadata), orthogonal to these handler literals.
- [i174-range-map-lexer](./174-shared-range-map-lexer.md) — the `rangeFunc`/`create`
  dispatch machinery these handlers plug into.
