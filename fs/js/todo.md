# 666-js-tokenizer-position-layer. Separate position/metadata tracking from the JS tokenizer core

**Priority:** P4
**Status:** open

## Problem

`fs/js/tokenizer/module.f.ts` already factors its character-to-token state machine
cleanly into a pure core that produces bare tokens:

```ts
// fs/js/tokenizer/module.f.ts:887-889
const tokenizeOp
    : StateScan<CharCodeOrEof, TokenizerState, List<JsToken>>
    = (input, state) => input === null ? tokenizeEofOp(state) : tokenizeCharCodeOp(input, state)
```

But the **line/column/path metadata** concern is interleaved on top of that core
and hard-wired into the only public entry point:

```ts
// fs/js/tokenizer/module.f.ts:895-908
const tokenizeWithPositionOp
    : StateScan<CharCodeOrEof, TokenizerStateWithMetadata, List<JsTokenWithMetadata>>
    = (input, {state, metadata}) => {
        ...
        const isNewLine = input == lf
        const newMetadata = { path: metadata.path, line: isNewLine ? metadata.line + 1 : ..., column: ... }
        return [ listMap(mapTokenWithMetadata(metadata))(newState[0]), { state: newState[1], metadata: newMetadata}]
    }

export const tokenize  // :912 — the ONLY public entry point; always emits metadata
    = input => path => { ... }
```

Because the metadata layer is fused into `tokenize`, a consumer that doesn't want
positions cannot get bare tokens. This is the source of friction downstream: the
JSON tokenizer passes an empty path purely to *discard* the position info it never
wanted (`fs/json/tokenizer/module.f.ts` calls `jsTokenize(input)('')`), while the
DJS tokenizer threads metadata everywhere. Both build on the same core but each
fights the single metadata-coupled entry point.

## Proposal

Separate the two concerns:

1. **Expose a raw entry point** that runs `tokenizeOp` and yields
   `List<JsToken>` without metadata (`tokenizeRaw`). JSON's tokenizer consumes this
   directly instead of supplying a dummy path and throwing positions away.
2. (Optional, defer until a second consumer) Express position tracking as a
   standalone generic combinator
   `StateScan<C, S, List<T>> → StateScan<C, {state:S, metadata}, List<{token:T, metadata}>>`,
   with newline detection passed in, so `tokenizeWithPositionOp` becomes one
   application of it. Per the repo's "extract at the second consumer" rule, the
   generic combinator has no second consumer yet — so the immediate, justified step
   is just (1): exposing the raw/no-metadata entry point.

This is a separation-of-concerns improvement: the lexical core and the source-
position bookkeeping become independently consumable, which also tidies the JSON
tokenizer's dummy-path workaround.

## Tasks

- [ ] export a `tokenizeRaw` (no-metadata) entry point built on `tokenizeOp`
- [ ] switch `fs/json/tokenizer` to consume it instead of `jsTokenize(input)('')`
- [ ] (defer) generic `withPosition` combinator once a second consumer appears

## Related

- `fs/js/tokenizer/module.f.ts` — pure core `tokenizeOp` (:887), position layer (:895)
- [i157](./157-json-djs-shared-core.md) — JSON/DJS value-layer sharing; the dummy-path
  workaround in `json/tokenizer` is downstream of this coupling

---

# 667-js-tokenizer-handler-literals. `js/tokenizer`: name the repeated token-emitting shapes in the number/escape handlers

**Priority:** P4
**Status:** open

## Problem

The number- and escape-state handlers in `fs/js/tokenizer/module.f.ts` repeat
the same token-emitting object literals, differing only in a constant (the next
`numberKind`, the `b` accumulator update, or the escaped character). The handler
*structure* is duplicated; only the data varies — exactly what DRY targets.

### 1. `digit0ToToken` and `digit19ToToken` are the same function

`fs/js/tokenizer/module.f.ts:575-587` and `:590-602` are line-for-line
identical except for the `numberKind` in the `default` branch:

```ts
// digit0ToToken  (575)            default: … numberKind: state.numberKind }]   // :586
// digit19ToToken (590)            default: … numberKind: 'int' }]              // :601
```

Every other branch (`'0'`, `'.'`/`'fractional'`, `'e'`/`'e+'`/`'e-'`/`'expDigits'`)
is byte-identical. The two are registered side by side in `parseNumberStateOp`:

```ts
// fs/js/tokenizer/module.f.ts:675
rangeFunc<ParseNumberState>(one(digit0))(digit0ToToken),
rangeFunc<ParseNumberState>(rangeOneNine)(digit19ToToken),
```

They are *not* provably equivalent — the `default` diverges when `numberKind`
is `'bigint'` (`123n4`: `digit0` keeps `'bigint'`, `digit19` switches to
`'int'`) — so the merge must preserve that delta, not assume it away.

### 2. The "continue a number token" literal appears ~9 times

The shape

```ts
[empty, { kind: 'number', value: appendChar(state.value)(input), b: <b>, numberKind: <k> }]
```

is written verbatim at `:570`, `:581`, `:585`, `:586`, `:596`, `:600`, `:601`,
`:611`, `:620`, `:629` — across `fullStopToToken`, both digit handlers,
`expToToken`, `hyphenMinusToToken`, and `plusSignToToken`. Only `<b>` and `<k>`
change; `kind`, `value: appendChar(state.value)(input)`, and the `[empty, …]`
envelope are constant noise repeated at every call site.

### 3. The five `\b \f \n \r \t` escape handlers differ only in the output char

`fs/js/tokenizer/module.f.ts:712-716`:

```ts
rangeFunc<ParseEscapeCharState>(one(latinSmallLetterB))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(backspace) }]),
rangeFunc<ParseEscapeCharState>(one(latinSmallLetterF))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(ff) }]),
rangeFunc<ParseEscapeCharState>(one(latinSmallLetterN))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(lf) }]),
rangeFunc<ParseEscapeCharState>(one(latinSmallLetterR))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(cr) }]),
rangeFunc<ParseEscapeCharState>(one(latinSmallLetterT))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(ht) }]),
```

Five rows that map `(escape letter) → (emitted char)`; the handler body is
identical apart from the constant.

## Proposal

Hoist the repeated shapes to named module-scope helpers, parameterized by the
varying constant. All three are pure and capture no local state, so they belong
at module scope per `AGENTS.md`.

### 1 + 2 — a `numberToken` constructor, and one `digitToToken` factory

The `numberKind` union and the `b` buffer shape are currently inline in
`ParseNumberState` (`fs/js/tokenizer/module.f.ts:297-300`); name them
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

### 3 — a `(letter, char)` escape table

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

## Tasks

- [ ] Add `numberToken` and route the ~9 continuing-number literals through it.
- [ ] Replace `digit0ToToken`/`digit19ToToken` with one `digitToToken` factory,
      preserving the `'bigint'`-state `default` difference.
- [ ] Replace the five fixed-char escape handlers with an `escapeTo` helper and a
      `(letter, char)` table.
- [ ] Confirm `fs/js/tokenizer` proof coverage still passes (`npm test`).

## Related

- [i157](./157-json-djs-shared-core.md) — shares the value layer above the
  tokenizer; this issue is purely internal to the JS lexer and independent.
- [i666-js-tokenizer-position-layer](./666-js-tokenizer-position-layer.md) —
  a separate concern (position/metadata), orthogonal to these handler literals.
- [i174-range-map-lexer](./174-range-map-lexer.md) — the `rangeFunc`/`create`
  dispatch machinery these handlers plug into.

---

# 174. `fsc` and `js/tokenizer`: a shared range-map lexer state machine

**Priority:** P3
**Status:** open

`fs/fsc/module.f.ts` and `fs/js/tokenizer/module.f.ts` are the only two
code-point scanners in the tree, and both hand-roll the *same* Mealy machine
over `range_map`: a state is a continuation `(codePoint) => [output, nextState]`,
transitions are looked up in a `RangeMapArray` of continuations, and overlapping
ranges are merged with one identical conflict rule. They differ only in the
output payload type.

```ts
// fs/fsc/module.f.ts:35
const union = <T>(a: CreateToResult<T>) => (b: CreateToResult<T>): CreateToResult<T> => {
    if (a === def || a === b) { return b }
    if (b === def) { return a }
    throw [a, b]
}

// fs/js/tokenizer/module.f.ts:330
const union
    : <T>(def: CreateToToken<T>) => (a: CreateToToken<T>) => (b: CreateToToken<T>) => CreateToToken<T>
    = def => a => b => {
    if (a === def || a === b) { return b }
    if (b === def) { return a }
    throw [a, b]
}
```

The rest of the machinery is the same algorithm with the payload type swapped:

| concern | `fsc` (`module.f.ts`) | `js/tokenizer` (`module.f.ts`) |
|---|---|---|
| continuation | `ToResult = (cp) => [string[], ToResult]` | `ToToken = (cp) => [List<JsToken>, TokenizerState]` |
| conflict merge | `union` :35 | `union` :330 |
| `range_map.merge` wrapper | `reduce` :43-51 | `rangeMapMerge` :338-344 |
| single-range cell | `codePointRange`/`range` :53-55 | `rangeFunc` :346-348 |
| range-set cell | `rangeSet` :57-66 | `rangeSetFunc` :361-370 |
| build + dispatch | `create` :68-73 | `create` :372-378 |

Both `create` functions even end with the byte-identical dispatch shape
`v => c => x(c)(i)(v)(c)`, where `x = get(def)`.

## Proposed abstraction

A new module (e.g. `fs/types/range_map/lexer/module.f.ts`) parameterized over
the continuation type `C` and the `def` continuation, exporting the
range/range-set cell combinators and the `create` builder:

```ts
// C is the state continuation, e.g. (input: number) => readonly [Out, C]
export const lexer = <C>(def: C) => {
    const union = (a: C) => (b: C): C => {
        if (a === def || a === b) { return b }
        if (b === def) { return a }
        throw [a, b]
    }
    const merge = rangeMapMerge({ union, equal: strictEqual, def })
    const range:    (r: Range)       => (f: C) => RangeMapArray<C>
    const rangeSet: (rs: List<Range>) => (f: C) => RangeMapArray<C>
    const create:   (cells: List<RangeMapArray<C>>) => C   // dispatch via get(def)
    return { range, rangeSet, create }
}
```

`fsc` then supplies `def = () => unexpectedSymbol` and an `asciiRange`-to-`Range`
adapter for its string-keyed `range('!')` ergonomics; `js/tokenizer` supplies
its `CreateToToken` continuation directly over `NumberRange`.

## Why this qualifies

- Two real, shipping consumers (`fsc.init`, the JS tokenizer's transition
  tables) — past the second-consumer bar in `AGENTS.md`.
- ~45 lines of reducer/merge/dispatch plumbing collapse into one factory; the
  conflict rule and `def`-merge are a genuine invariant, currently copied
  verbatim including the `throw [a, b]` ambiguity guard.
- Naming the construct ("a range-driven lexer state machine") makes the next
  scanner reuse it instead of forking a third copy.

## Caveats / why this is an idea, not a mechanical edit

- **`def` threading.** `fsc` closes over a module-level `def` constant;
  `js/tokenizer` threads `def` as a parameter through every combinator
  (`union(def)`, `rangeMapMerge(def)`, `scanRangeOp(def)`). The factory closes
  over `def` once, which matches `fsc` and simplifies the tokenizer.
- **Range vocabulary.** `fsc` works in ASCII characters via
  `text/ascii.range`; the tokenizer works in numeric `NumberRange`. The factory
  should stay numeric (`Range`/`NumberRange`) and let `fsc` keep its
  string→range adapter on top, so the lexer core has no `ascii` dependency.
- **Distinct from [i165](./README.md).** That issue proposes a BNF-driven
  tokenizer/parser layering; these two scanners are *not* BNF-based and are the
  only `range_map`-driven ones. This extraction stands on its own.

## Related

- [i165](./README.md) — layered BNF parser (different mechanism).
- `fs/types/range_map/module.f.ts` — the underlying structure both consumers wrap.

---

