## Remove JSON parsing from the DJS parser

**Priority:** P2
**Status:** open

### Problem

The DJS parser reads two things it should not: a JSON *document*, and a bare
value standing in for a module.

- `parseJsonFromTokens` ([`parser/module.f.mjs`](../parser/module.f.mjs)) is
  the whole parser with one rule relaxed — `"__proto__"` as a data key — and
  the transpiler hands a `.json` root to it.
- `parseInitialOp` falls through to `exportValue` when the first token is not
  `import`, `const`, or `export`, so `{"a":1}` parses as a module whose body
  is that value. This is the "JSON is a subset of FunctionalScript" path
  ([spec/1000-json](../../../spec/1000-json.md)).

**A valid JSON document is not a valid FunctionalScript module.** As
JavaScript, most JSON documents do not parse at all — `{"a":1}` is
`SyntaxError: Unexpected token ':'`, since `{` opens a block and `"a":1` is no
labeled statement — and the ones that do parse (`[1,2]`, `5`, `null`) are
statements, not exports, so importing one fails with *"does not provide an
export named 'default'"*. Either way a JS engine does not give that text the
value the DJS parser gives it, which is principle 2.

So the subset claim is false as stated: JSON is a data language the compiler
also reads, not a subset of the module language. What is true is the narrower
statement that every JSON *value* is a DJS value.

### Proposal

The DJS parser parses FunctionalScript modules and nothing else: a module is
`import`/`const` statements and an `export default`. A text without one is a
parse error, whatever it would mean as data.

`fjs compile` keeps reading a `.json` input as JSON, through the reader that
owns that language — [`fjs/media/json/parser`](../../media/json/parser) — and
wraps the value it returns as a module body with no imports and one constant.
Two languages, two parsers, and the extension picks between them
([spec/2480-proto-property-key](../../../spec/2480-proto-property-key.md)).

Most of what this removes is code this repository added recently:
`parseJsonFromTokens`, the `_Language` field of the parser's module state, and
the `pushStringKey`/`pushIdKey` split — which collapses back into one
`pushPlainKey` that refuses `__proto__` in both spellings, because the
language that reads it as data is no longer this parser.

### Consequences

- **Importing a JSON file stops working**, since a JSON document is no longer
  a module. That is the same end state as
  [spec/todo/2140-import-attributes](../../../spec/todo/2140-import-attributes.md),
  where `with { type: "json" }` is what makes a JSON import legal and sends it
  to the JSON reader — so this issue and that one want landing together, or
  this one first with the import left unavailable in between.
- **`.json` inputs lose their error positions.** `fjs/media/json/parser`
  reports one shared error value with no metadata, so
  `path:line:column - error: …` becomes `undefined:undefined:undefined`
  (see [parse-error-location-format](./parse-error-location-format.md)).
  Giving the JSON parser positions is a prerequisite, not an afterthought.
- **`.json` inputs stop accepting DJS extensions** — `bigint`, `undefined`,
  comments, identifier keys, computed keys, `import`, `const` — because the
  JSON reader accepts none of them. That is the point, and it is a breaking
  change for any file relying on it.
- **The spec's subset claim changes.** [spec/README](../../../spec/README.md)
  §1 and [1000-json](../../../spec/1000-json.md) say a JSON document is a
  valid FunctionalScript module; they would say instead that a JSON document
  is data the compiler reads, and that JSON's values are DJS values. The
  `__proto__` exception in
  [2480](../../../spec/2480-proto-property-key.md) then stops being an
  exception to a subset claim and becomes an ordinary difference between two
  languages.

### Tasks

- [ ] Positions in `fjs/media/json/parser`'s errors.
- [ ] `fjs compile` reads a `.json` input with the JSON parser, wrapping its
      value as an `AstModule`.
- [ ] The DJS parser requires `export default`: delete the bare-value entry
      path.
- [ ] Delete `parseJsonFromTokens`, `_Language`, and the two-spelling key
      split.
- [ ] Rewrite the subset claim in `spec/README` §1, `spec/1000-json`, and the
      subset-exception section of `spec/2480-proto-property-key`.
- [ ] Decide what happens to a JSON import in the meantime — see
      [2140](../../../spec/todo/2140-import-attributes.md).

### Related

- [spec/todo/2140-import-attributes](../../../spec/todo/2140-import-attributes.md)
  — the clause that makes a JSON import legal again.
- [spec/2480-proto-property-key](../../../spec/2480-proto-property-key.md) —
  the one rule the two languages differ in, and why the JSON reading exists at
  all.
- [663-json-djs-tree-type](./663-json-djs-tree-type.md) — the value shapes the
  two languages share, which this does not change: JSON values stay DJS
  values.
