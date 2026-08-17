# FunctionalScript Language

Two main FunctionalScript principles:

1. if FS code passes validation/compilation, then it doesn't have side-effects,
2. the code that passed validation/compilation should behave on FunctionalScript VM the same way as on any other modern JavaScript engine.

FunctionalScript does not whitelist individual JavaScript operations in isolation. It whitelists complete semantic patterns. Some otherwise-forbidden JavaScript constructs may appear only as components of recognized patterns that lower to FunctionalScript primitives.

When we implement features of FunctionalScript, the first priority is a simplification of the VM.

## Scope

This directory specifies the language that the compiler accepts **today**: a
module of the language described here is exactly a module that

```sh
fjs compile <input> <output>
```

compiles. Every feature listed below is recognized by the `fjs` parser and has
a specification document in this directory.

Everything else — features the parser does not recognize yet, and the design
documents for the VM, I/O, serialization, and the rest of the roadmap — lives
in [`spec/todo/`](./todo/README.md). A document moves from `spec/todo/` to
`spec/` when the parser recognizes its feature.

## File types

|File Type|Extension|Notes|
|---------|---------|-----|
|JSON|`.json`|Tree.|
|FJS source|`.f.mjs`|Graph with functions. Authored ESM JavaScript with JSDoc types; the extension does **not** imply that the current FunctionalScript parser/compiler accepts the module.|
|FJS source|`.f.js`|Generated output; must not be authored.|

Once authored `.f.js` package support is complete, compiler-supported `.f.mjs`
modules may move to authored `.f.js`, making `.f.js` the
compiler-compatibility marker. This migration grows incrementally as compiler
support grows. See [`fjs/fsc/README.md`](../fjs/fsc/README.md) for the
authoritative extension contract and
[`todo/migrate-typescript-to-mjs.md`](../todo/migrate-typescript-to-mjs.md) for the
repository migration plan.

## 1. JSON

A JSON document forms a **tree** of values and is itself a valid
FunctionalScript module: JSON is a subset of FunctionalScript, with one
documented exception — a document containing a `__proto__` key
([proto-property-key](./2480-proto-property-key.md)).

1. [JSON](./1000-json.md).

## 2. DJS

DJS is the data subset of FunctionalScript: a module denotes a **graph** of
values — `import` and `const` name the shared parts — and a DJS value can be
serialized without additional run-time information.

### 2.1. Module structure

A module is a sequence of statements. Each statement is terminated by the end
of the line; semicolons are not part of the language.

|Statement|Form|Specification|
|---------|----|-------------|
|default import|`import name from "./path"`|[default-import](./2130-default-import.md)|
|constant|`const name = expression`|[const](./2120-const.md)|
|default export|`export default expression`|[default-export](./2110-default-export.md)|

- `export default` is the last statement of a module; only comments and
  whitespace may follow it.
- Imported and constant names share one namespace: declaring the same name
  twice is an error.
- A name must be declared before it is used;
  [forward references](./todo/3140-forward-references.md) are not recognized
  yet.
- An import path is a string literal, resolved relative to the importing
  module. Each module is parsed and evaluated once per resolved path; a
  circular dependency is an error.
- An imported file is read as a FunctionalScript module whatever its
  extension. A JSON document is one, so importing `.json` works; what the
  extension cannot do is choose the language, because that is the import
  statement's job and the language has no `with { type: "json" }` clause yet
  ([import-attributes](./todo/2140-import-attributes.md)). Until it does, such
  an import is also the one place a module the compiler accepts is not a
  module a JavaScript engine loads, which requires the attribute.

### 2.2. Expressions

An expression is a data expression. Function definitions, operators, and
property access are not recognized yet — see the
[roadmap](./todo/README.md).

|Expression|Example|Specification|
|----------|-------|-------------|
|`null`, `true`, `false`|`null`|[JSON](./1000-json.md)|
|number|`-42.5`, `3e2`|JSON number syntax, [JSON](./1000-json.md)|
|string|`"hello"`|JSON string syntax, [JSON](./1000-json.md)|
|`undefined`|`undefined`|[undefined](./2310-undefined.md)|
|`bigint`|`34n`|[bigint](./2320-bigint.md)|
|array|`[1, "a"]`|[JSON](./1000-json.md)|
|object|`{ "a": 1 }`|[JSON](./1000-json.md)|
|reference|`a`|a declared `import` or `const` name|

Notes:

- String literals use JSON string syntax at every level: double quotes and
  JSON escapes. Single quotes, and the full set of JS string spellings, are a
  deferred feature — see
  [js-string-literals](./todo/2460-js-string-literals.md).
- An object property key is a string literal, an identifier
  ([identifier-property](./2410-identifier-property.md)), or a string literal
  in brackets ([computed-property](./2470-computed-property.md)). The brackets
  hold a literal, not an expression.
- `__proto__` is a key only in the bracketed form: the other two spellings
  assign a prototype in JavaScript and are compilation errors
  ([proto-property-key](./2480-proto-property-key.md)).
- Arrays and objects may have a trailing comma
  ([trailing-comma](./2430-trailing-comma.md)).

### 2.3. Comments

Comments are trivia: they may appear between any two tokens and are ignored.

1. [block-comment](./2210-block-comment.md) — `/* ... */`, needed for
   JSDoc/TypeScript type declarations,
2. [line-comment](./2420-line-comment.md) — `// ...`.

## 3. Compilation

`fjs compile` evaluates the input module — resolving every `import` — and
serializes its exported value. The output file extension picks the format:

```sh
fjs compile input.f.js output.f.js   # JavaScript module
fjs compile input.f.js output.json   # JSON
```

- A JavaScript module output preserves the object graph: a value referenced
  more than once is emitted as a `const` and stays shared.
- A JSON output is a tree, so shared values are expanded, and types that JSON
  cannot express (`bigint`, `undefined`) are not available.
- Object properties are emitted in sorted key order.
- The input extension names its language the same way: a `.json` input is a
  JSON document, anything else a FunctionalScript module. The two readers
  differ in one rule — a `"__proto__"` key — and a `__proto__` key is emitted
  as `["__proto__"]:` in a JavaScript module and as `"__proto__":` in JSON
  ([proto-property-key](./2480-proto-property-key.md)). This applies to the
  file named on the command line; every file it imports is read as a
  FunctionalScript module (§2.1).

See [fjs/djs/README.md](../fjs/djs/README.md) for the data language
implementation and [fjs/fsc/README.md](../fjs/fsc/README.md) for the compiler.

## Specification documents

|#|Feature|
|-|-------|
|1000|[JSON](./1000-json.md)|
|2110|[default-export](./2110-default-export.md)|
|2120|[const](./2120-const.md)|
|2130|[default-import](./2130-default-import.md)|
|2210|[block-comment](./2210-block-comment.md)|
|2310|[undefined](./2310-undefined.md)|
|2320|[bigint](./2320-bigint.md)|
|2410|[identifier-property](./2410-identifier-property.md)|
|2420|[line-comment](./2420-line-comment.md)|
|2430|[trailing-comma](./2430-trailing-comma.md)|
|2470|[computed-property](./2470-computed-property.md)|
|2480|[proto-property-key](./2480-proto-property-key.md)|

Everything not listed here — unimplemented language features (§1010, §2.x
remainder, §3 FJS functions), ECMAScript proposals, I/O effects, the
content-addressable VM, object identity, mutability, and serialization — is
in [`spec/todo/`](./todo/README.md).
