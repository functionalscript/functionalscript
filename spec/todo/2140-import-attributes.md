# Import Attributes

```js
import a from './a.json' with { type: "json" }
export default [a]
```

A JSON module is imported with an attribute naming its type. JavaScript
requires it — without the attribute the same line is an error, so a
FunctionalScript module that imports JSON today is not a JavaScript module,
which is principle 2.

## Why

`fjs compile` reads its input as a JSON document when the extension says so
([proto-property-key](../2480-proto-property-key.md)), and a module may import
such a file. On a JavaScript engine that import behaves differently — Node 22,
ESM:

|`import`|result|
|-|-|
|`import x from './a.json'`|`ERR_IMPORT_ATTRIBUTE_MISSING`|
|`import x from './a.json' with { type: "json" }`|the parsed document|
|`import x from './a.f.js' with { type: "json" }`|`ERR_IMPORT_ATTRIBUTE_TYPE_INCOMPATIBLE`|
|`import x from './a.json' with { foo: "bar" }`|`ERR_IMPORT_ATTRIBUTE_UNSUPPORTED`|

The parser has it exactly backwards: it accepts the first line, which no
JavaScript engine loads, and rejects the second with `unexpected token`.

## Rules

- The clause is `with` followed by an object of attributes. The only attribute
  is `type`, and its only value is the string `"json"`; any other key or value
  is an error, as it is in JavaScript.
- The attribute declares the type, it does not reinterpret the file: it must
  agree with what the extension already says, so `type: "json"` on a
  FunctionalScript module is an error. The extension names the language of the
  file `fjs compile` is given
  ([proto-property-key](../2480-proto-property-key.md)); this is how a module
  names the language of a file it imports.
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
file is named — which is what the compiler does today. Nothing has to change
for that: JSON is a subset of FunctionalScript, so importing a JSON document
already works, and the one document that stops at the door is the one carrying
a `__proto__` key, which as a module means a prototype assignment.

**So this feature is purely additive.** It adds the only spelling that reads
an imported file as JSON, and no import changes meaning when it lands. The
end state is the JavaScript one: the attribute is *required* to import a JSON
document — a `.json` import without it is `ERR_IMPORT_ATTRIBUTE_MISSING` on
any engine, so FunctionalScript should refuse it too rather than quietly
reading the file as a module.

## Notes

- The serializer never emits an `import`, so this is a parser-side feature
  only.
- The transpiler already reads only its root file by extension (`parserFor` in
  [`fjs/djs/transpiler`](../../fjs/djs/transpiler/module.f.mjs)) and every
  import as FunctionalScript. What this feature adds is the second reader at
  the import site: a module's import list is `readonly string[]`
  ([`ast/types.ts`](../../fjs/djs/ast/types.ts)) and would carry each path's
  declared type alongside it.
- `import type` ([namespace-import](./2220-namespace-import.md)) is a separate
  clause on the same statement and is unaffected.

Depends on [default-import](../2130-default-import.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#import_attributes
and the TC39 [import attributes](https://github.com/tc39/proposal-import-attributes)
proposal.
