## json-bigint-serialization. A bigint-precise parse/serialize pair, in `djs`, staying JSON-compatible

**Priority:** P3
**Status:** open

### Problem

Every JSON number in `fs/media/json`'s pipeline collapses to a JS `number`,
even though the tokenizer computes an exact value first and then throws the
precision away: `NumberToken.bf: BigFloat` (`fs/js/tokenizer/module.f.ts:81-85`)
is exact, but `fs/media/json/parser/module.f.ts:121`'s `tokenToValue`
immediately does `parseFloat(token.value)`. Concretely, parsing
`{"id": 9007199254740993}` (`2^53 + 1`) silently yields `9007199254740992` —
no error, just a wrong value.

`fs/media/json` itself should **not** change to fix this: it exists to mirror
native `JSON.parse`/`JSON.stringify` exactly, and its `Unknown`/`Primitive`
types are depended on by `fs/mcp`, `fs/cas/mcp`, `fs/mcp/stdio`, `fs/fsm`,
`fs/dev/package_json`, and others via plain `typeof` switches — widening
`Primitive` with `bigint` there would be a breaking change to all of them for
no benefit to callers who just want standard JSON semantics.

`fs/djs` (a JS-superset format transpiled from/to `.f.ts`) already has the
right leaf type: `Primitive = JsonPrimitive | bigint | undefined`
(`fs/djs/module.f.ts:22`). But its only bigint encoding today is the JS
literal suffix — `fs/types/bigint/module.f.ts:90`: `` `${a}n` `` — which is
not valid JSON. This is not just a theoretical gap: `fs/djs/module.f.ts`'s
`compile` **already has a live bug** from it. Its `.json`-output branch —

```ts
// fs/djs/module.f.ts:42-44
const content = outputFileName.endsWith('.json')
    ? stringifyAsTree(sort)(result[1])
    : stringify(sort)(result[1])
```

— uses `stringifyAsTree`, which is `serializeWithoutConst`
(`fs/djs/serializer/module.f.ts:133-135`), whose leaf switch has
`case 'bigint': { return [bigintSerialize(value)] }`
(`fs/djs/serializer/module.f.ts:120`) — emitting `123n`. So compiling any
djs module that contains a bigint to an output path ending in `.json`
**writes invalid JSON to a `.json` file**, silently. `fs/djs/proof.f.ts`'s
`jsonOutput` test only exercises `export default 42` (a plain number), so
this is untested and unnoticed today.

### Proposal

Add a second parse/serialize pair to `fs/djs` — alongside the existing
`123n`-syntax native djs serialization — that encodes the `number`/`bigint`
distinction using JSON's own number grammar instead of new syntax, so its
output is valid, standard-JSON-parseable text:

- **Parse.** Reuse `fs/media/json/tokenizer` as-is (it already rejects
  djs-only tokens like a bigint-suffix literal or a bare identifier, so this
  new parser only ever accepts plain JSON syntax — no consts, no imports, no
  `123n`). A JSON `number` token whose literal has no `.` and no exponent
  (`e`/`E`) — the bare `int` production of RFC 8259 §6 — parses to `bigint`
  via the token's own `bf[0]` (exact, no re-parsing); everything else parses
  to `number` as today. Don't duplicate `fs/media/json/parser/module.f.ts`'s
  state machine to get this: add a new exported `parseWith` (name TBD) that
  takes the `tokenToValue` mapping as a parameter, with the existing `parse`
  becoming `parseWith(defaultTokenToValue)` — purely additive, the three
  existing callers (`fs/dev/package_json`, `fs/mcp/stdio`,
  `fs/media/revision`) are untouched.
- **Serialize.** Reuse `fs/media/json/serializer`'s leaf-agnostic atoms
  (`objectWrap`, `arrayWrap`, `stringSerialize`, `boolSerialize`,
  `nullSerialize` — already shared with djs's own serializer, see
  `fs/djs/serializer/module.f.ts:15`). Add a `bigint` case emitting plain
  digits (no `n` suffix) instead of djs's `bigintSerialize`, and make the
  `number` case force a `.0` onto whole-number inputs
  (`Number.isInteger(input)`) so `3` (bigint) and `3.0` (float) stay
  distinguishable on the wire. JS's own exponential-notation threshold
  (`JSON.stringify` switches to `e` form exactly at `1e21`) means the
  plain-digit case and the exponent case never overlap, so no special-casing
  is needed there — just append `.0` when the output has neither `.` nor
  `e`.
- **Fix the live bug.** Once this exists, `fs/djs/module.f.ts`'s `compile`
  should use the new bigint-JSON-compatible serializer for its `.json`
  branch instead of `stringifyAsTree`, so a bigint-containing module compiled
  to `*.json` produces valid JSON instead of `123n`.

### Prior art: Python's `json` module

Python's `int` is arbitrary-precision, and its stdlib `json` module already
implements exactly this split. CPython's number scanner
(`Lib/json/scanner.py`, mirrored by the `_json` C accelerator) matches
`(-?(?:0|[1-9]\d*))(\.\d+)?([eE][-+]?\d+)?` and dispatches:

```python
if frac or exp:
    res = parse_float(integer + (frac or '') + (exp or ''))
else:
    res = parse_int(integer)
```

`parse_int` defaults to `int`, `parse_float` to `float` — "no `.`/no
exponent → integer type, otherwise → float type," confirming `1e2` parses
as `float(100.0)` (exponent presence alone routes to float, matching the
strict-grammar reading above, not "no fractional value" more broadly). On
the write side Python needs no special `.0` convention at all —
`json.dumps` calls `float.__repr__` directly, which already always emits a
`.` or exponent (`repr(3.0) == '3.0'`) — so `int`/`float` stay lexically
distinct for free. The `.0`-forcing step this proposal needs is exactly
what Python's separate `int`/`float` types already guarantee without extra
logic; JS's single `number` type is what makes it necessary here.

### Open questions

- **Value type.** djs's own `Primitive` includes `undefined`, which has no
  JSON encoding — so should this new pair's type be djs's `Unknown` as-is
  (permissive on the way in, but the serializer must reject/error on
  `undefined`), or a narrower `JsonPrimitive | bigint` leaf set (no
  `undefined`, matching what JSON-syntax input can actually produce)? The
  narrower type is cleaner but is a third leaf-set instantiation alongside
  json's and djs's — ties this proposal to
  [663-json-djs-tree-type](./663-json-djs-tree-type.md)'s generic
  `Tree.Unknown<P>` work, which would make adding a third instantiation
  trivial instead of a fourth hand-rolled type. Worth sequencing these two
  together, or at least deciding the order explicitly.
- **Naming and placement.** Candidates: `parseJson`/`stringifyJson` (reads
  oddly next to djs's *actual* JSON-incompatible native format),
  `parseJsonBigint`/`stringifyJsonBigint` (verbose but unambiguous). Home:
  directly on `fs/djs/module.f.ts`, or a new `fs/djs/json_bigint/module.f.ts`
  submodule alongside `ast`/`parser`/`serializer`/`tokenizer`/`transpiler`.
- `-0`: `Number.isInteger(-0)` is `true` — does it need `.0` too (`-0.0`)?
  `NaN`/`Infinity` are already outside valid JSON, out of scope.
- Document, wherever this lands, that djs now has **two** bigint encodings
  (`123n` native, plain-digit-JSON-compatible here) with different
  tradeoffs, so a future reader doesn't wonder why.

### Tasks

- [ ] Add `parseWith` (name TBD) to `fs/media/json/parser/module.f.ts`,
      parameterized over `tokenToValue`; reimplement `parse` on top of it
      with the current `tokenToValue` as the default — no behavior change
      for existing callers.
- [ ] Settle the value-type open question above (plain `djs.Unknown` vs. a
      narrower `JsonPrimitive | bigint`), coordinating with
      [663-json-djs-tree-type](./663-json-djs-tree-type.md) if the narrower
      type is chosen.
- [ ] Implement the new parse function in `fs/djs` using
      `fs/media/json/tokenizer` + `parseWith` with a `bigint`-for-bare-integers
      `tokenToValue`.
- [ ] Implement the new serialize function reusing
      `fs/media/json/serializer`'s atoms, with a plain-digit `bigint` case
      and `.0`-forcing on whole `number`s.
- [ ] Fix `fs/djs/module.f.ts`'s `compile` `.json` branch to use the new
      serializer instead of `stringifyAsTree`; add a proof case compiling a
      bigint-containing module to `*.json` and asserting the output is valid
      JSON (parses back with a JSON-only bigint-aware parser and round-trips).
- [ ] Add proof coverage: integers beyond `Number.MAX_SAFE_INTEGER`
      round-trip exactly as `bigint`; a whole-number `number` still
      round-trips distinctly as `number`; fractional/exponent-form literals
      stay `number`; djs-only syntax (`123n`, bare identifiers, `undefined`)
      is rejected by the new parser.
- [ ] Document the convention (`3` = bigint, `3.0` = float) and its
      relationship to djs's native `123n` encoding, in `fs/djs/README.md`.
- [ ] `npx tsc`, `fjs t`.

### Related

- [todo/new-pl.md § Numbers](../../../todo/new-pl.md#numbers) — the
  from-scratch-language version of this same idea (`2` = bigint, `2.0` =
  number as the *default* literal syntax, no suffix). This proposal is the
  scoped-down, buildable-today instance of it: same `int`/`float` split,
  same Python precedent, but as a JSON-compatible serialization convention
  inside today's `fs/djs` rather than a change to literal syntax.
- [663-json-djs-tree-type](./663-json-djs-tree-type.md) — generalizes the
  json/djs recursive tree type over its leaf set; this proposal's value type
  is naturally a third instantiation of that generic if the narrower-type
  option is chosen.
- [parse-text-pipeline.md](../../media/json/todo/parse-text-pipeline.md) —
  adds a `parseText` (string → `Result`) entry point to `fs/media/json`; the
  `parseWith` generalization here is the same shape of change (a new
  parameterized entry point, existing behavior preserved as the default),
  just on the token-list parser rather than the string-to-tokens pipeline.
- `fs/media/json/schema/module.f.ts:93-97,106-107` — already documents a
  `bigint`-as-`Number()` lossy approximation elsewhere (rtti → JSON Schema);
  a related but separate concern (schema description, not value encoding).
- `fs/djs/proof.f.ts`'s `jsonOutput` test — the existing (too narrow)
  coverage of `compile`'s `.json` branch; extend rather than replace.
