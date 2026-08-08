## Use 256-bit bigint BNF symbols

**Priority:** P3
**Status:** blocked
**Blocked by:** [Bigint-aware JSON parse/serialize](../../media/json/todo/bigint-parse-serialize.md)

### Problem

BNF symbols are currently limited to 24 bits so two range endpoints can be packed
into one safe JavaScript `number`. This keeps `TerminalRange` compact, but it also
makes the symbol alphabet an implementation limit of the parser.

Layered parsing needs a much larger symbol space. A tokenizer should be able to
emit a token symbol that the next BNF parser consumes directly, including symbols
derived from descriptive token names or, later, cryptographic hashes.

Changing BNF data from `number` to `bigint` also means the data representation can
no longer round-trip through native `JSON.parse` / `JSON.stringify`. The bigint-
precise JSON parse/serialize task provides the JSON-compatible representation this
change needs.

### Proposal

Use a fixed 256-bit unsigned symbol space represented by `bigint`:

```ts
type Symbol = bigint
```

with the invariant:

```text
0 <= symbol < 2^256
```

Keep terminal ranges fixed-width as well. Pack the inclusive start/end symbols
into one 512-bit `bigint`:

```text
TerminalRange = (start << 256) | end
```

This preserves the current simple range algebra while removing the 24-bit limit.
Keep the symbol space finite so `fullRange`, `eof`, complements, and range checks
remain well-defined. `eof` can continue to use the maximal symbol value.

Unicode code points remain ordinary symbol values inside the larger domain; only
the representation changes from `number` to `bigint` when they enter BNF.
Metadata carried alongside symbols is unchanged.

A 256-bit symbol also leaves a natural path for token mappings whose output is a
cryptographic hash. The mapping itself is a separate task; this TODO only changes
the BNF symbol domain and range representation.

### Tasks

- [ ] Introduce a BNF `Symbol` type backed by `bigint` with the 256-bit invariant.
- [ ] Change `TerminalRange` to a 512-bit packed `bigint` range of two symbols.
- [ ] Update `fullRange`, `unicodeRange`, `eof`, `rangeEncode`, `rangeDecode`,
      `oneEncode`, and range/set helpers for bigint symbols.
- [ ] Update BNF data, parsers, recognizers, AST/meta inputs, and proofs to consume
      bigint symbols.
- [ ] Convert Unicode code points to bigint only at the BNF boundary; keep text
      code-point APIs unchanged unless a separate reason requires changing them.
- [ ] Verify range complement and ordering semantics over the full 256-bit domain.
- [ ] Add proof coverage for minimum/maximum symbols, Unicode boundaries, EOF,
      singleton ranges, general ranges, and complements.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Bigint-aware JSON parse/serialize](../../media/json/todo/bigint-parse-serialize.md)
  — exact JSON-compatible parse/serialize support required by bigint-valued BNF
  data.
- [UTF-8 token symbols](./utf8-token-symbols.md) — replace registered 24-bit token
  IDs with deterministic token-name-derived symbols after this task lands.
- [Layered parser](./layered-parser.md) — tokenizer output becomes input symbols to
  the next BNF layer.
- [`fjs/bnf/module.f.ts`](../module.f.ts) — current 24-bit symbol/range encoding.
