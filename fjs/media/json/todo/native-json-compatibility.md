## Native JSON.parse/stringify compatibility

**Priority:** P5
**Status:** open
**Blocked by:** [Standard JSON parse/serialize](./standard-parse-serialize.md)

### Goal

Improve compatibility between FunctionalScript `json.parse` / `json.stringify`
and native JavaScript `JSON.parse` / `JSON.stringify` only when there is a
concrete reason to do so.

This is deliberately low priority. Do not block the Extended JSON codec, the
standard FunctionalScript JSON codec, BNF bigint work, or other P3 tasks on exact
native compatibility.

### Direction

Once Extended JSON and the standard/extended runtime transforms exist, we can
improve compatibility incrementally.

There are two valid paths:

1. gradually change the default `json.parse` / `json.stringify` behavior toward
   native semantics, accepting explicit breaking changes when appropriate;
2. if we discover that both contracts are useful, add a separately named
   native-compatible parser/stringifier policy over the same shared structural
   machinery.

Do not choose between these approaches now. The existence of a future
compatibility requirement is not enough reason to maintain two APIs today.

Any compatibility implementation must reuse the same tokenizer, lossless
`NumberToken` structural parse, and recursive serializer. Only materialization,
normalization, and numeric formatting policy should differ.

### Compatibility areas

Investigate only as demanded by real consumers. Candidate differences include:

- throwing vs `Result`-returning parse APIs;
- `-0` parsing/stringification;
- `NaN`, `Infinity`, and `-Infinity` serialization;
- exponent overflow such as `1e400`;
- very large integer input and JavaScript-number rounding/overflow;
- native shortest-round-trip number spelling;
- property ordering;
- optional native features such as reviver, replacer, and indentation.

Existing measurements or examples may be retained as reference, but they should
not cause additional P3 design work.

### Tasks

- [ ] Wait for a concrete compatibility requirement before implementation.
- [ ] Compare the then-current FunctionalScript JSON behavior with the required
      subset of native `JSON.*`.
- [ ] Decide whether to converge the default API through documented breaking
      changes or add a separate native-compatible API.
- [ ] Reuse the shared structural parser/serializer; do not fork JSON parsing.
- [ ] Add differential proofs only for the compatibility surface we actually
      decide to support.
- [ ] Do not add reviver/replacer/pretty-print parity unless a consumer needs it.

### Related

- [Standard JSON parse/serialize](./standard-parse-serialize.md) — P3 default
  FunctionalScript codec; should not wait for this task.
- [Standard/extended value transforms](./standard-transform.md) — make gradual
  policy changes easier once the runtime layers exist.
- [Extended JSON bigint parse/serialize](./bigint-parse-serialize.md) — preserves
  more numeric information and provides the shared structural substrate.
- [JSON numeric edge cases](./number-edge-cases.md) — owns only the decisions
  needed by the FunctionalScript codecs; native-only questions belong here.
