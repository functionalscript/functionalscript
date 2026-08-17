## Parse by grammar, not by file extension

**Priority:** P2
**Status:** open

### Problem

`transpile` ([`transpiler/module.f.mjs`](../transpiler/module.f.mjs)) chooses
its reader from the file name:

```js
const parserFor = path => path.endsWith('.json') ? parseJsonFromTokens : parseFromTokens
```

The two readers differ in one rule — `"__proto__"` is an ordinary data key in
a JSON document and a prototype assignment in JavaScript
([spec/2480-proto-property-key](../../../spec/2480-proto-property-key.md)) — so
**the file name decides what a text means**. Rename `a.json` to `a.f.js` and
the same bytes stop compiling. Meaning should come from the text, not from
metadata around it, and a parser that takes a language flag has two grammars
in one state machine with no grammar written down for either.

The extension is load-bearing in a second way nobody checks: a file named
`.json` may contain `bigint`, `undefined`, comments, identifier keys, computed
keys, `import`, and `const`, none of which is JSON. Calling it "the JSON
reader" is already false; it is the DJS reader with one rule relaxed.

### Proposal

One grammar accepting both languages, with the distinction inside it instead
of in a parameter. The reader takes a token list and nothing else.

The distinguishing construct is already there: **a module statement**. A text
with `import`, `const`, or `export default` is a JavaScript module, and a JS
engine evaluating it applies the prototype rule. A text that is a bare value
is not a JavaScript module at all — `{"a":1}` at statement position is a block,
not an object literal — so its only reading is as data, and `"__proto__"` is a
key there for the same reason `JSON.parse` makes it one.

```text
document = jsonValue | module
module   = statement* 'export' 'default' value
```

That yields the rule the extension is standing in for today, and gets it from
the text:

| text | reading | `"__proto__":` |
|------|---------|----------------|
|`{"__proto__":5}`|value document|a data key|
|`export default {"__proto__":5}`|module|error|

It is also principle-2-correct in a way the extension check is not: the
rejection lands exactly on the texts a JavaScript engine would read
differently, and never on a text no engine would accept as a module.

Which is worth checking against the current implementation, where a bare value
is parsed as a module whose body is that value — the "JSON is a subset of
FunctionalScript" path. Under this proposal a bare value is a *document*, and
the subset claim becomes a statement about two branches of one grammar rather
than about one reader accepting both.

The grammar belongs where the tokenizer's already is,
[`fjs/bnf`](../../bnf/README.md) — `djs/tokenizer` exports `jsMatcher`, a BNF
matcher, while the parser below it is a hand-written fold. Writing the parser's
grammar down is most of the value here; merging the two languages is what makes
it worth doing now.

### Tasks

- [ ] Decide whether a bare value document may use DJS extensions (`bigint`,
      `undefined`, comments, identifier and computed keys) or must be JSON —
      today it may, and nothing checks a `.json` file for JSON syntax.
- [ ] Write the merged grammar, `document = jsonValue | module`.
- [ ] One reader over it: drop `parseJsonFromTokens`, the `_Language` field of
      the parser's module state, and `parserFor` in the transpiler.
- [ ] Proof that the same bytes compile the same way under every file name,
      the test the current design cannot pass.
- [ ] Update [spec/2480-proto-property-key](../../../spec/2480-proto-property-key.md)
      and [spec/README](../../../spec/README.md) §3, which both state the rule
      in terms of the file extension.

### Related

- [spec/2480-proto-property-key](../../../spec/2480-proto-property-key.md) —
  the one rule the two readings differ in.
- [`fjs/media/json/parser`](../../media/json/parser) — the other JSON reader in
  the repository, which the transpiler does not use. Its errors carry no
  position, so it is not a drop-in for the `.json` path; a merged grammar makes
  the question of switching to it moot.
