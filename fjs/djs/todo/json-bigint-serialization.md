## Use bigint-aware JSON for DJS interchange

**Priority:** P3
**Status:** open

### Problem

`fjs/djs` supports `bigint`, but its native serialization uses JavaScript bigint
literal syntax such as `123n`, which is not valid JSON.

This already affects `fjs/djs/module.f.mjs`'s `.json` output path: it uses the DJS
tree serializer, so a DJS value containing a bigint can be written as `123n` to
a file whose extension is `.json`. The current proof only covers a plain
`number`, so this case is not caught.

The generic JSON layer should own the JSON-compatible bigint representation.
DJS should consume that representation rather than implementing a second
bigint-aware JSON parser/serializer itself.

DJS values may also contain `undefined`, which JSON cannot represent. The generic
bigint-aware JSON value type therefore must not be widened with `undefined` just
to accept DJS values.

### Proposal

Use [`fjs/media/json/extended`](../../media/json/extended/module.f.mjs)'s
parse/serialize pair anywhere DJS needs JSON interchange.

Keep the two formats distinct:

- native DJS uses JavaScript/DJS syntax such as `123n` and may contain
  `undefined`;
- JSON interchange uses valid JSON syntax where integer tokens represent
  `bigint`, decimal/exponent tokens represent `number`, and `undefined` is not a
  valid value.

In particular, change the DJS compiler's `.json` branch to use the generic
bigint-aware JSON serializer so bigint-containing output is valid JSON.

Before serialization, validate that the DJS value is representable by the
bigint-aware JSON value type. If `undefined` occurs anywhere — as the root value,
an array element, or an object property value — fail the `.json` compilation with
a clear error instead of silently normalizing it. Do not omit object properties or
replace array entries with `null`; those transformations lose information and are
not part of this interchange format.

This keeps the generic serializer's input type precise and gives every unsupported
DJS value the same behavior regardless of where it appears in the tree.

### Tasks

- [ ] Add/reuse a recursive conversion or validation from DJS `Unknown` to the
      bigint-aware JSON value type; reject `undefined` at any depth.
- [ ] Make `.json` compilation report an error and not write JSON output when the
      DJS result contains `undefined` as the root, an array element, or an object
      property value.
- [ ] Replace the DJS compiler's `.json` serialization path with the generic
      bigint-aware JSON serializer after successful validation.
- [ ] Reuse/export the generic bigint-aware JSON parser where DJS needs to read
      JSON while preserving bigint values; do not duplicate the JSON parser.
- [ ] Add a proof that compiles a DJS value containing bigint to `*.json`, checks
      that the result is valid JSON syntax, and round-trips it through the
      bigint-aware JSON parser.
- [ ] Add proof coverage that `.json` compilation rejects `undefined` at the root,
      in an array, and in an object property.
- [ ] Keep native DJS serialization unchanged (`123n` and `undefined` remain DJS
      syntax).
- [ ] Document the distinction between native DJS and bigint-aware JSON
      interchange in `fjs/djs/README.md`.
- [ ] `tsc`, `fjs test`.

### Related

- [`fjs/media/json/extended/module.f.mjs`](../../media/json/extended/module.f.mjs)
  — generic implementation this task consumes.
- [663-json-djs-tree-type](./663-json-djs-tree-type.md) — generic recursive tree
  typing may simplify sharing the bigint-aware JSON value type.
- [Integer literal `123` is a `bigint`](../../../todo/blocked/integer-as-bigint.md)
  — broader language-level direction; this task only concerns DJS/JSON
  interchange.
