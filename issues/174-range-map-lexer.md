# 174. `fsc` and `js/tokenizer`: a shared range-map lexer state machine

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
