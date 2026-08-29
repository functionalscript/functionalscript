## DataJS conformance vectors

**Priority:** P2
**Status:** open

### Problem

[`spec/datajs/README.md`](../README.md) states conformance in prose. Prose
cannot be executed, so nothing stops the reference implementation and the
specification from drifting apart — which is exactly what happened to the
`fjs/fsc` grammar that stage 2 deleted, unproven and unimported.

The stages that follow all need the same corpus:
stage 3 (JSON's self-contained tokenizer) must prove JSON's accepted language
is unchanged, stage 4 (`fjs/media/datajs`) must prove the parser and
serializer implement *the spec* rather than each other, and stage 6 must prove
the DataJS ⊂ FunctionalScript ⊂ JavaScript subset laws. One corpus, four
consumers.

### Proposal

A machine-readable corpus with three parts:

- **accept** — document text plus the graph it denotes, including the sharing.
  Cases: every leaf (`-0`, `NaN`, `±Infinity`, bigint, `undefined`), the
  `["__proto__"]` key, duplicate keys (last value, first position), array-index
  key ordering, one-line and readable spellings of the same value, empty
  containers, deep nesting, and shared nodes reached by several paths.
- **reject** — document text plus what is wrong with it. Cases: a missing or
  non-final `export default`, a missing `;`, `;;`, a trailing comma, a comment,
  an `import`, an identifier key, a bare or string `"__proto__"` key, `1.5n`,
  `1e2n`, `01n`, `-NaN`, `-undefined`, a bare `-`, a forward or unbound
  reference, a rebound name, each excluded const name, single quotes, `\x` and
  `\u{…}` escapes, U+2028/U+2029/NBSP/FF/BOM outside a string.
- **serializer reject** — programmatic inputs a serializer must refuse rather
  than approximate: a function, symbol or `Date` leaf, a sparse-array hole, a
  symbol-keyed, accessor or non-enumerable own property, an array carrying an
  own property beyond its elements and `length` (`a=[1]; a.meta=2`), and a
  cycle. Each is a case where the obvious implementation emits a valid
  document denoting something else.
- **graph equivalence** — an input graph and the documents that do and do not
  denote it, so a serializer cannot pass by emitting merely *valid* output:
  `[a,a]` with one shared `a` is not `export default [[],[]];`.
- **normalize** — an input document and the exact bytes normalized form must
  produce: const hoisting by reference identity, post-order `_0`, `_1`, …
  naming, `ToString(Number)` spelling with the `-0` exception,
  `QuoteJSONString` escaping, observable key order, one-line layout. Pin the
  number thresholds explicitly — `1e20`, `1e21`, `1e-6`, `1e-7`,
  `5e-324`, `1.7976931348623157e308` — since that is where a host's own
  formatter diverges, and pin `root=[p,p]` with `p=[c]` so the hoisting count
  is occurrences rather than paths. Include a normalized root that is a bare
  number and a bare bigint, so `export default 1;` cannot regress to
  `export default1;` — which JavaScript rejects, `default1` being one
  identifier.

The corpus is data, not code, so it can be read by an implementation in any
language. Store it as DataJS once `fjs/media/datajs` can read it; until then
JSON, since the corpus must be readable by the very implementation it tests —
a corpus that can only be read by a working DataJS parser cannot be used to
bring one up.

Two properties worth proving directly rather than case by case: every
**accept** document parses in FunctionalScript to the same graph, and every
**accept** document is accepted by a JavaScript engine with the same result.
Those are the subset laws, and they can run over the whole accept set.

### Tasks

- [ ] Choose the corpus's own encoding and location, per the bootstrapping
      constraint above.
- [ ] Write the accept, reject and normalize sets covering the cases listed.
- [ ] Add the two whole-set subset-law checks.
- [ ] Point stages 3, 4 and 6 at the corpus as their proof source.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`spec/datajs/README.md`](../README.md) — the specification the corpus
  makes executable; its Conformance section links back here.
- [`todo/parser-serializer-restructure.md`](../../../todo/parser-serializer-restructure.md)
  — the plan; this is the second half of its stage 1.
