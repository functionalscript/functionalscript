## Use 256-bit bigint BNF symbols

**Priority:** P3
**Status:** blocked
**Blocked by:** [Bigint-aware JSON parse/serialize](../../media/json/todo/bigint-parse-serialize.md), [Separate alphabet-specific BNF helpers](./unicode-rules.md)

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

The generic BNF core should also be separated from alphabet-specific rule
construction first, so changing the symbol representation does not preserve or
reinforce the current assumption that BNF symbols are Unicode code points.

### Proposal

Use one fixed 256-bit unsigned symbol representation backed by `bigint`:

```ts
type Symbol = bigint
```

with the invariant:

```text
0 <= symbol < 2^256
```

Reserve the maximal value for EOF:

```text
EOF = 2^256 - 1
```

Ordinary input symbols occupy `0 .. EOF - 1`. EOF is represented as a normal
BNF symbol/range value rather than as a separate terminal kind. This keeps one
representation throughout the parser stack: scanners, parsers, recognizers,
serialized BNF data, and range operations do not need a second EOF case in their
APIs.

Keep terminal ranges fixed-width as well. Pack the inclusive start/end symbols
into one 512-bit `bigint`:

```text
TerminalRange = (start << 256) | end
```

Define `fullRange` over ordinary input symbols only, `0 .. EOF - 1`, while `eof`
is the singleton range `EOF .. EOF`. Complements over ordinary symbols therefore
do not include EOF, while grammars can still refer to EOF with the same
`TerminalRange` representation as every other terminal.

#### EOF in parser input

Alphabet adapters and callers provide only physical input symbols. They do **not**
append the reserved EOF value or invent metadata for it. Every parser backend
instead synthesizes exactly one logical EOF symbol immediately after the last
physical input symbol.

Terminal matching therefore has three logical positions:

```text
idx < input.length   -> match the physical input symbol
idx == input.length  -> match the synthesized EOF symbol
idx > input.length   -> no symbol remains
```

Matching EOF consumes that one logical symbol, so it advances the parser past the
end position and EOF cannot be consumed repeatedly. Indexed parsers can represent
that post-EOF position as `input.length + 1`; remainder-based parsers need an
equivalent internal state that distinguishes "at EOF" from "EOF already
consumed".

The synthesized EOF has no physical source element and therefore contributes no
ordinary symbol/metadata leaf to the AST. Diagnostics that reject a terminal at
EOF still point at the physical end position (`input.length`). This avoids
requiring a generic metadata type `T` to manufacture EOF metadata while keeping
EOF itself in the same `Symbol` / `TerminalRange` representation as every other
terminal.

This is parser end-of-stream semantics, not a second EOF type. Alphabet adapters
must never produce the reserved EOF value as ordinary input; mappings whose
natural output can reach it must reject or remap it at their boundary.

Unicode code points and bytes are possible symbol alphabets supplied through
alphabet-specific helpers; the generic BNF core itself should know neither
Unicode nor byte-stream semantics. Those adapters convert their values into the
new bigint symbol domain. Metadata carried alongside physical symbols is
unchanged.

A 256-bit symbol also leaves a natural path for token mappings whose input may be
arbitrarily large and whose output is a cryptographic hash. Such mappings must
avoid the single reserved EOF value. That constraint belongs to the mapping
boundary, not to BNF parsers.

### Tasks

- [ ] Introduce a BNF `Symbol` type backed by `bigint` with the 256-bit invariant.
- [ ] Reserve `2^256 - 1` as EOF; ordinary symbols are smaller values.
- [ ] Change `TerminalRange` to a 512-bit packed `bigint` range of two symbols.
- [ ] Define `fullRange` over ordinary symbols only and `eof` as the singleton
      maximal-symbol range.
- [ ] Update generic `rangeEncode`, `rangeDecode`, `oneEncode`, complement/range
      helpers, and their callers for bigint symbols.
- [ ] Update every parser/recognizer backend to synthesize exactly one logical EOF
      after physical input, consume it at most once, and distinguish the post-EOF
      state without requiring callers to append EOF.
- [ ] Keep synthesized EOF out of ordinary AST metadata leaves; preserve end-of-
      input diagnostics at the physical end position.
- [ ] Update BNF data, parsers, recognizers, AST/meta inputs, and proofs to consume
      bigint symbols without introducing a separate EOF representation.
- [ ] Update alphabet-specific helpers so their input values are converted to
      bigint ordinary symbols only at their BNF boundary and never emit reserved
      EOF; keep source-domain APIs unchanged.
- [ ] Verify range complement and ordering semantics over the 256-bit domain,
      including the boundary immediately below EOF.
- [ ] Add proof coverage for minimum/maximum ordinary symbols, EOF, singleton
      ranges, general ranges, complements, alphabet-adapter boundaries, explicit
      EOF on empty/non-empty input, failure before physical end, and the one-time
      EOF-consumption rule.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Bigint-aware JSON parse/serialize](../../media/json/todo/bigint-parse-serialize.md)
  — exact JSON-compatible parse/serialize support required by bigint-valued BNF
  data.
- [Separate alphabet-specific BNF helpers](./unicode-rules.md) — makes the core
  BNF symbol algebra independent of Unicode and byte-stream semantics before its
  representation changes.
- [UTF-8 token symbols](./utf8-token-symbols.md) — replace registered 24-bit token
  IDs with deterministic token-name-derived symbols after this task lands.
- [Layered parser](./layered-parser.md) — tokenizer output becomes input symbols to
  the next BNF layer.
- [`fjs/bnf/module.f.ts`](../module.f.ts) — current 24-bit symbol/range encoding.
