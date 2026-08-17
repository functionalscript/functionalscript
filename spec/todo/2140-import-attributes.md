# Import Attributes

```js
import a from './a.json' with { type: "json" }
import b from './b.txt' with { type: "text" }
export default [a, b]
```

A file that is not a module is imported with an attribute naming its type:
`"json"` for a JSON document, `"text"` for a string. This is the only way to
import either — an import resolves to a FunctionalScript module, and neither a
JSON document nor a text file is one — and it is the spelling JavaScript
requires, which is principle 2.

The two types are at opposite ends of the same clause and arrive on different
schedules: `"json"` is standard and shipping, and the parser is behind it;
`"text"` is Stage 3 and no engine has it yet, so the parser must not get ahead
of it.

## Why

`fjs compile` reads its input as a JSON document when the extension says so
([1000-json](../1000-json.md)), but a module has no way to name one: an import
resolves to a FunctionalScript module, and a JSON document is not a module. In
JavaScript the attribute is what names it — Node 22, ESM:

|`import`|result|
|-|-|
|`import x from './a.json'`|`ERR_IMPORT_ATTRIBUTE_MISSING`|
|`import x from './a.json' with { type: "json" }`|the parsed document|
|`import x from './a.f.js' with { type: "json" }`|`ERR_IMPORT_ATTRIBUTE_TYPE_INCOMPATIBLE`|
|`import x from './a.json' with { foo: "bar" }`|`ERR_IMPORT_ATTRIBUTE_UNSUPPORTED`|
|`import x from './a.json' with { type: "text" }`|`ERR_IMPORT_ATTRIBUTE_UNSUPPORTED`|

The parser recognizes none of these: the clause itself is `unexpected token`,
so the second line — the one JavaScript wants — cannot be written, and the
first fails in the imported file, which is not a module.

## Rules

- The clause is `with` followed by an object of attributes. The only attribute
  is `type`, and its values are the strings `"json"` and `"text"`; any other
  key or value is an error, as it is in JavaScript.
- `type: "json"` declares a type, it does not reinterpret the file: it must
  agree with what the extension already says, so `type: "json"` on a
  FunctionalScript module is an error. The extension names the language of the
  file `fjs compile` is given
  ([proto-property-key](../2480-proto-property-key.md)); this is how a module
  names the language of a file it imports.
- `type: "text"` is not a language claim — it says the file is not parsed at
  all — so whether it likewise has to agree with an extension is an open
  question. Taking the bytes of `./LICENSE`, of a `.txt`, or of a `.f.js` is
  the same operation, and the proposal's own example imports a file no
  extension rule would recognize; whatever JavaScript settles on is what to
  follow.
- The attribute value is a string literal, like an import path — not an
  expression.

## The attribute selects the reader

**An imported file is parsed as JSON only when its import carries
`with { type: "json" }`.** The extension does not select it: a file has no say
in how it is read, which is also what keeps
`import x from './a.f.js' with { type: "json" }` an error rather than a
reinterpretation. The extension declares a file's language to whoever names
the file, and an import *is* that naming — so the importing module says which
language it expects, and the extension must agree
([proto-property-key](../2480-proto-property-key.md)).

The root input of `fjs compile` is the one file no import names, so its
extension stays its declaration:

```sh
fjs compile proto.json a.js   # read as JSON: nothing else can say so
```

Until the clause exists, an import reads a FunctionalScript module however the
file is named — which is what the compiler does today — and a JSON document is
not a module ([1000-json](../1000-json.md)), so **importing JSON does not work
at all**. The clause is the only thing that would make it work.

**So this feature is purely additive**, and it is the whole feature rather
than a spelling for one: no import changes meaning when it lands, because no
import reads JSON today. It arrives already matching JavaScript, where the
attribute is *required* — a `.json` import without one is
`ERR_IMPORT_ATTRIBUTE_MISSING` on any engine, and here it is a parse error in
the imported file.

## `type: "text"`

```js
import license from './LICENSE' with { type: "text" }
export default { license }
```

A text import is a file read as a string, and a string is a DJS value — so
this is the second reader the clause selects, next to JSON, and the cheapest
one: no tokenizer, no parser, no `AstModule`. The file's bytes decode as UTF-8
into one leaf value.

It is [TC39's import-text proposal](https://github.com/tc39/proposal-import-text),
Stage 3 as of March 2026, and its rules are the ones to take: the decoding is
UTF-8 with no way to ask for another encoding, so a file that is not UTF-8 is
an error rather than a mojibake string. The sibling
[import-bytes](https://github.com/tc39/proposal-import-bytes) proposal
(`type: "bytes"`, a `Uint8Array`) is what a non-UTF-8 file would go through,
and is a separate question here — DJS has no byte-array value.

**Not implemented by engines yet.** Node 22 answers
`ERR_IMPORT_ATTRIBUTE_UNSUPPORTED` for `type: "text"`, so a module using it
does not load today. That is the reverse of the `"json"` case, where the
parser is behind the engines: here the parser would be ahead of them, which
is a principle-2 hazard of its own — a module the compiler accepts that no
engine runs. Landing `"text"` therefore waits on Stage 4 and shipping
implementations, while `"json"` does not wait on anything.

## Notes

- The serializer never emits an `import`, so this is a parser-side feature
  only.
- [`fjs/djs/transpiler`](../../fjs/djs/transpiler/module.f.mjs) already has
  the two readers, chosen by the root file's extension: `transpileJson` for a
  `.json` input, `transpileModule` for everything else, with every import
  going to the latter. What this feature adds is that same choice at the
  import site — a module's import list is `readonly string[]`
  ([`ast/types.ts`](../../fjs/djs/ast/types.ts)) and would carry each path's
  declared type alongside it. A `"text"` import needs a third reader, which is
  no reader at all: the file is not parsed, so it has no imports to resolve.
- `import type` ([namespace-import](./2220-namespace-import.md)) is a separate
  clause on the same statement and is unaffected.

Depends on [default-import](../2130-default-import.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#import_attributes
and the TC39 [import attributes](https://github.com/tc39/proposal-import-attributes)
proposal.
