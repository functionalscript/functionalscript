## 667-js-tokenizer-handler-literals. `js/tokenizer`: name the repeated token-emitting shapes in the number/escape handlers

**Priority:** P4
**Status:** open

### Problem

The number- and escape-state handlers in `fjs/js/tokenizer/module.f.ts` repeat
the same token-emitting object literals, differing only in a constant (the next
`numberKind`, the `b` accumulator update, or the escaped character). The handler
*structure* is duplicated; only the data varies — exactly what DRY targets.

#### 1. `digit0ToToken` and `digit19ToToken` are the same function

`fjs/js/tokenizer/module.f.ts:575-587` and `:590-602` are line-for-line
identical except for the `numberKind` in the `default` branch:

```ts
// digit0ToToken  (575)            default: … numberKind: state.numberKind }]   // :586
// digit19ToToken (590)            default: … numberKind: 'int' }]              // :601
```

Every other branch (`'0'`, `'.'`/`'fractional'`, `'e'`/`'e+'`/`'e-'`/`'expDigits'`)
is byte-identical. The two are registered side by side in `parseNumberStateOp`:

```ts
// fjs/js/tokenizer/module.f.ts:675
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

`fjs/js/tokenizer/module.f.ts:712-716`:

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
`ParseNumberState` (`fjs/js/tokenizer/module.f.ts:297-300`); name them
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

#### 3 — a `(letter, char)` escape table

```ts
const escapeTo = (c: number) =>
    (state: ParseEscapeCharState) => (): readonly[List<JsToken>, TokenizerState] =>
        [empty, { kind: 'string', value: appendChar(state.value)(c) }]

const simpleEscapes = [
    [latinSmallLetterB, backspace],
    [latinSmallLetterF, ff],
    [latinSmallLetterN, lf],
    [latinSmallLetterR, cr],
    [latinSmallLetterT, ht],
] as const

// in parseEscapeCharStateOp:
…simpleEscapes.map(([letter, c]) => rangeFunc<ParseEscapeCharState>(one(letter))(escapeTo(c)))
```

This leaves the genuinely distinct handlers (`"`/`\`/`/` self-insert via
`appendChar(state.value)(input)`, and `u` → `unicodeChar`) as their own rows.

### Tasks

- [ ] Add `numberToken` and route the ~9 continuing-number literals through it.
- [ ] Replace `digit0ToToken`/`digit19ToToken` with one `digitToToken` factory,
      preserving the `'bigint'`-state `default` difference.
- [ ] Replace the five fixed-char escape handlers with an `escapeTo` helper and a
      `(letter, char)` table.
- [ ] Confirm `fjs/js/tokenizer` proof coverage still passes (`npm test`).

### Related

- [i157](../djs/todo.md) — shares the value layer above the
  tokenizer; this issue is purely internal to the JS lexer and independent.
- [i666-js-tokenizer-position-layer](todo.md) —
  a separate concern (position/metadata), orthogonal to these handler literals.
- [i174-range-map-lexer](todo.md) — the `rangeFunc`/`create`
  dispatch machinery these handlers plug into.
