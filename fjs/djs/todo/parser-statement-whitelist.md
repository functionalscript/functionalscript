## Recognize only `import`, `const`, and `export` statements

**Priority:** P2
**Status:** open

### Problem

`parseInitialOp` ([`parser/module.f.mjs`](../parser/module.f.mjs)) falls
through to `exportValue` when a statement does not begin with `import`,
`const`, or `export`, so a text that begins with a **value** parses as a
module whose body is that value: `42`, `[1,2]`, and `{"a":1}` are all
accepted today.

JavaScript does not agree. `{"a":1}` does not parse at all — `{` opens a
block, and `"a":1` is no labeled statement — and the texts that do parse are
statements, not exports, so importing one fails with *"does not provide an
export named 'default'"*. The parser gives such a text a value no engine gives
it, which is principle 2. Whitelisting complete forms rather than accepting
whatever can be read is the rule the language is built on
([spec/README](../../../spec/README.md)).

### Proposal

A module is a sequence of statements, and a statement begins with `import`,
`const`, or `export`. Any other first token is an error — the same
`unexpected token` the parser already reports, at the token that starts the
statement.

The three are a whitelist, not a closed set: more statement forms land as the
language grows ([spec/todo](../../../spec/todo/README.md)). What goes away is
the fallthrough that lets *anything else* through by treating it as a value.

### Consequences

- **A JSON document stops parsing as a module**, which is the point: a valid
  JSON document is not a valid FunctionalScript module. The JSON reading the
  DJS parser carries — `parseJsonFromTokens` and the `_Language` field of its
  module state, with the `pushStringKey`/`pushIdKey` split it forced — goes
  with it, leaving one `pushPlainKey` that refuses `__proto__` in both
  spellings.
- **`fjs compile x.json` needs the JSON reader**,
  [`fjs/media/json/parser`](../../media/json/parser), with its value wrapped
  as a module body. That parser reports one shared error with no metadata, so
  giving it positions comes first, or `.json` diagnostics become
  `undefined:undefined:undefined`
  ([parse-error-location-format](./parse-error-location-format.md)). A `.json`
  input also stops accepting `bigint`, `undefined`, comments, and identifier
  or computed keys, none of which is JSON.
- **Importing a JSON file stops working** until
  [2140](../../../spec/todo/2140-import-attributes.md) gives the import a way
  to say `with { type: "json" }` and send the file to the JSON reader.
- **The spec's subset claim narrows.** [spec/README](../../../spec/README.md)
  §1 and [1000-json](../../../spec/1000-json.md) say a JSON document is a
  valid FunctionalScript module; what stays true is that every JSON *value* is
  a DJS value. The `__proto__` exception in
  [2480](../../../spec/2480-proto-property-key.md) then stops being an
  exception to a subset claim and becomes an ordinary difference between two
  languages.

### Tasks

- [ ] A statement not starting with `import`, `const`, or `export` is an
      error; delete the value fallthrough in `parseInitialOp`.
- [ ] Delete `parseJsonFromTokens`, `_Language`, and the two-spelling key
      split.
- [ ] Positions in `fjs/media/json/parser`'s errors, then read a `.json` input
      with it.
- [ ] Rewrite the subset claim in `spec/README` §1, `spec/1000-json`, and the
      subset-exception section of `spec/2480-proto-property-key`.

### Related

- [spec/todo/2140-import-attributes](../../../spec/todo/2140-import-attributes.md)
  — what makes a JSON import legal again.
- [spec/2480-proto-property-key](../../../spec/2480-proto-property-key.md) —
  the one rule the two languages differ in.
- [663-json-djs-tree-type](./663-json-djs-tree-type.md) — the value shapes the
  two languages share, which this does not change.
