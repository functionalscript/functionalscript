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

## Open question

Whether the attribute becomes **required** for a `.json` import, matching
JavaScript, or is merely accepted. Requiring it is the principle-2 answer and
breaks every module importing JSON without one. Accepting both leaves the
parser admitting a module that no engine will load, which is the defect this
document exists to close, so requiring it is the intended end state; a release
that accepts both is a migration step, not the destination.

## Notes

- The serializer never emits an `import`, so this is a parser-side feature
  only.
- `import type` ([namespace-import](./2220-namespace-import.md)) is a separate
  clause on the same statement and is unaffected.

Depends on [default-import](../2130-default-import.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#import_attributes
and the TC39 [import attributes](https://github.com/tc39/proposal-import-attributes)
proposal.
