## Use bigint-aware JSON for DJS interchange

**Priority:** P3
**Status:** blocked
**Blocked by:** [Bigint-aware JSON parse/serialize](../../media/json/todo/bigint-parse-serialize.md)

### Problem

`fjs/djs` supports `bigint`, but its native serialization uses JavaScript bigint
literal syntax such as `123n`, which is not valid JSON.

This already affects `fjs/djs/module.f.ts`'s `.json` output path: it uses the DJS
tree serializer, so a DJS value containing a bigint can be written as `123n` to
a file whose extension is `.json`. The current proof only covers a plain
`number`, so this case is not caught.

The generic JSON layer should own the JSON-compatible bigint representation.
DJS should consume that representation rather than implementing a second
bigint-aware JSON parser/serializer itself.

### Proposal

After [bigint-parse-serialize](../../media/json/todo/bigint-parse-serialize.md)
lands, use that parse/serialize pair anywhere DJS needs JSON interchange.

Keep the two formats distinct:

- native DJS uses JavaScript/DJS syntax such as `123n`;
- JSON interchange uses valid JSON syntax where integer tokens represent
  `bigint` and decimal/exponent tokens represent `number`.

In particular, change the DJS compiler's `.json` branch to use the generic
bigint-aware JSON serializer so bigint-containing output is valid JSON.

### Tasks

- [ ] Replace the DJS compiler's `.json` serialization path with the generic
      bigint-aware JSON serializer.
- [ ] Reuse/export the generic bigint-aware JSON parser where DJS needs to read
      JSON while preserving bigint values; do not duplicate the JSON parser.
- [ ] Add a proof that compiles a DJS value containing bigint to `*.json`, checks
      that the result is valid JSON syntax, and round-trips it through the
      bigint-aware JSON parser.
- [ ] Keep native DJS serialization unchanged (`123n` remains DJS syntax).
- [ ] Document the distinction between native DJS and bigint-aware JSON
      interchange in `fjs/djs/README.md`.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Bigint-aware JSON parse/serialize](../../media/json/todo/bigint-parse-serialize.md)
  — generic implementation this task consumes.
- [663-json-djs-tree-type](./663-json-djs-tree-type.md) — generic recursive tree
  typing may simplify sharing the bigint-aware JSON value type.
- [Integer literal `123` is a `bigint`](../../../todo/blocked/integer-as-bigint.md)
  — broader language-level direction; this task only concerns DJS/JSON
  interchange.
