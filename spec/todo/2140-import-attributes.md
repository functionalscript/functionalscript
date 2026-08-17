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

`fjs compile` reads a `.json` input as a JSON document
([proto-property-key](../2480-proto-property-key.md)), and a module may import
one. On a JavaScript engine that import behaves differently — Node 22, ESM:

|`import`|result|
|-|-|
|`import x from './a.json'`|`ERR_IMPORT_ATTRIBUTE_MISSING`|
|`import x from './a.json' with { type: "json" }`|the parsed document|
|`import x from './a.f.js' with { type: "json" }`|`ERR_IMPORT_ATTRIBUTE_TYPE_INCOMPATIBLE`|
|`import x from './a.json' with { foo: "bar" }`|`ERR_IMPORT_ATTRIBUTE_UNSUPPORTED`|

The parser has it exactly backwards: it accepts the first line, which no
JavaScript engine does, and rejects the second with `unexpected token`.

## Rules

- The clause is `with` followed by an object of attributes. The only attribute
  is `type`, and its only value is the string `"json"`; any other key or value
  is an error, as it is in JavaScript.
- The attribute declares the type, it does not reinterpret the file: it must
  agree with what the extension already says, so `type: "json"` on a
  FunctionalScript module is an error. The extension names the language on both
  sides of a compile ([proto-property-key](../2480-proto-property-key.md)), and
  this is how a module states that in its own text.
- The attribute value is a string literal, like an import path — not an
  expression.

## The attribute selects the reader

**An imported file is parsed as JSON only when its import carries
`with { type: "json" }`.** Without the attribute the file is read as a
FunctionalScript module, whatever it is called: a `.json` extension alone no
longer sends it to the JSON reader.

That is the same rule as before, read from the right place. The extension
declares a file's language to whoever names the file, and an import *is* that
naming — the importing module says which language it expects, and the
extension must agree ([proto-property-key](../2480-proto-property-key.md)). A
file has no say in how it is read, which is what keeps
`import x from './a.f.js' with { type: "json" }` an error rather than a
reinterpretation.

The root input of `fjs compile` is the one file no import names, so its
extension stays its declaration:

```sh
fjs compile proto.json a.js   # read as JSON: nothing else can say so
```

## Open question

Whether the attribute becomes **required** for a `.json` import, matching
JavaScript, or a bare import of one is read as a FunctionalScript module.
Requiring it is the principle-2 answer and breaks every module importing JSON
without one. Reading it as a module instead is a quiet migration — JSON is a
subset of FunctionalScript, so every such import goes on meaning what it
means today, except one: a document with a `__proto__` key, which stops
compiling until the attribute is added
([proto-property-key](../2480-proto-property-key.md)). Requiring the attribute
is the intended end state either way; the question is only whether a release
passes through the quieter form on the way.

## Notes

- The serializer never emits an `import`, so this is a parser-side feature
  only.
- The transpiler picks its reader from the path of every file it reads
  (`parserFor` in [`fjs/djs/transpiler`](../../fjs/djs/transpiler/module.f.mjs)).
  Under the rule above that choice belongs to the import statement, so an
  imported file's reader comes from the attribute and only the root file's
  from its path. A module's import list is `readonly string[]`
  ([`ast/types.ts`](../../fjs/djs/ast/types.ts)) and would carry each path's
  declared type alongside it.
- `import type` ([namespace-import](./2220-namespace-import.md)) is a separate
  clause on the same statement and is unaffected.

Depends on [default-import](../2130-default-import.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#import_attributes
and the TC39 [import attributes](https://github.com/tc39/proposal-import-attributes)
proposal.
