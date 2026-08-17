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

### What JavaScript does

JavaScript decides this question the other way, and principle 2 makes its
answer evidence rather than trivia. `import` never looks at the bytes:

|`import` in Node 22 (`"type": "module"`)|result|
|-|-|
|`import x from './data.json'`|`ERR_IMPORT_ATTRIBUTE_MISSING`, "needs an import attribute of `type: json`"|
|`import x from './data.json' with { type: 'json' }`|`{ a: 1 }`|
|`{"a":1}` in a `.js` file, no attribute|`SyntaxError: Unexpected token ':'` — read as JavaScript|
|the same `.js` file `with { type: 'json' }`|`ERR_IMPORT_ATTRIBUTE_TYPE_INCOMPATIBLE`|

The extension (or, in a browser, the response MIME type) fixes the module
type; the import attribute is **required** for JSON and may only agree with it.
The last row is the sharp one: the attribute cannot reinterpret a file, and no
amount of JSON-shaped content makes a `.js` file JSON. Sniffing is absent on
purpose — a server serving JSON that a page executes as JavaScript is XSSI, so
the type is declared, never guessed.

Reading a JSON document as JavaScript, meanwhile, yields nothing rather than a
value: `{"a":1}` is not even parseable (`{` opens a block, and `"a":1` is no
labeled statement — a label must be an identifier), and the documents that do
parse — `[1,2]`, `5`, `null`, `{a:1}` — are statements, not exports, so the
import fails with "does not provide an export named 'default'".

So today's `parserFor` is a degenerate form of JavaScript's own answer: the
extension decides, but nothing in the source says what the author meant. The
choice below is therefore not "extension versus grammar" but **declaration
versus grammar**, and a third option exists — keep the extension and let the
source declare the language, the way `with { type: "json" }` does.

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

### Alternative: the declaration, JavaScript's answer

Keep the extension as the language selector and let the source say what it
means, the way an import attribute does. Sniffing a text for its language is
what JavaScript refused to do, and the grammar above is a form of sniffing:
adding `export default` to a document silently changes what a `__proto__` key
in it means, which is the "same bytes, different meaning" the problem section
objects to, moved from the file name into the text.

The counter-argument is that the compiler reads a named local file rather than
an untrusted response, so the XSSI reasoning does not transfer, and that a
document with no module statement is not JavaScript in any reading — the
grammar is not guessing between two possible meanings, it is refusing to
invent a JavaScript meaning for a text JavaScript rejects.

Deciding between the two is the point of this issue; the tasks below assume
the grammar and will need rewriting if the declaration wins.

### A related gap: FunctionalScript imports of JSON

`import a from "./x.json"` is accepted by the DJS parser and — since the
extension change — read as a JSON document. **That same line is an error in
JavaScript**: `ERR_IMPORT_ATTRIBUTE_MISSING`, as the table above shows. So an
FS module importing JSON does not behave on a JavaScript engine the way it
behaves here, which is principle 2. The language has no `with { type: … }`
clause today, so the import cannot be spelled correctly at all. Whichever
option wins above, the import surface needs one of: an import-attribute
clause, or a rule that JSON is not importable.

### Tasks

- [ ] Decide between the merged grammar and a source-level declaration; the
      remaining tasks assume the grammar.
- [ ] Import attributes, or a rule that a JSON file is not importable — today
      `import a from "./x.json"` is accepted here and is an error in
      JavaScript.
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
