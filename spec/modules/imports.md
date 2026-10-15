# Importing Other Modules

**Status:** implemented

```js
import a from "./a.f.js";
import { add, subtract as sub, } from "./math.f.js";
import { default as config } from "./config.f.js";
import d, { value as v } from "./mixed.f.js";
import {} from "./checked.f.js";
```

An `import` statement selects exports from another module's complete export
object. The exported name selects the property; an alias changes only its local
binding. Named-only modules need no default export.

The completed [named-import proposal](../named-imports.md) records the design
scope and language-designer authorization.

- The selected export must exist, even when its binding is unused. A present
  export whose value is `undefined` is valid; an absent export is an error.
- A selection reads an own property of the export object, so a built-in
  prototype's name selects an export like any other:
  `import { __proto__ as p, constructor as c } from "./dep.f.js";` binds the
  dependency's own exports of those names, and one it does not export —
  `toString`, `hasOwnProperty` — is an absent export, not a built-in.
  [Property access](../property-access/README.md) refuses these names as keys; a
  selection is not an access. The FunctionalScript output refuses such an
  importer today (`a prohibited property name`), since it writes the selection
  as an access; the other outputs accept it.
- Named lists admit aliases, trailing commas, `default as name`, and an empty
  list. A default binding may precede a named list.
- An empty list still loads and evaluates the dependency. Unused imports and
  unselected export initializers retain their required evaluation and failures.
- Namespace imports ([namespace-import](../todo/2220-namespace-import.md)),
  string-literal export names, bare side-effect imports, and re-exports remain
  unsupported.
- The module specifier is a [string literal](../values/strings.md), resolved using the
  declared host environment's module-resolution rules. Relative specifiers
  resolve against the importing module's identity; bare specifiers follow the
  host's package or import-map rules. Unsupported specifier classes are
  refused, not reinterpreted as sibling filesystem paths.
- Within one program load, imports resolving to the same module identity
  share its evaluation and exported value. Distinct module identities remain
  distinct even when they load the same file; loading paths are not cache
  keys. A circular dependency is an error.
- Local bindings are names under the [rule](../bindings/constants.md) a
  `const` follows — `import { a as let }` and `import eval from "./e.f.js"`
  are errors, `import from from "./f.f.js"` is not — and cannot duplicate
  another import or module constant, both being names of the one module
  function ([a module is a function](README.md#a-module-is-a-function)). Exported names are identifier names;
  reserved words such as `default` require a valid local alias.
- Every `import` comes before every `const`
  ([module structure](README.md)).

**Current supported host profile:** the Node runner resolves admitted file imports
against the importing file URL, canonicalizes symlinks, and reuses modules by the
resulting file URL identity. Imports use portable URL-path spellings beginning
with `./`, `../`, or `/`. Absolute `file:` imports and query/fragment components
are outside the supported grammar, as are bare packages and other URL schemes.
Encoded filename characters such as `%23` still work. This is the default Node
file-module profile; preserve-symlinks modes are not supported profiles.

The profile does not yet cover a module's format, only its resolution and
identity. An import without the attribute is read by the module parser
whatever the file it resolves to is called — `.f.js`, `.js`, `.mjs`,
`.data.js`, `.ts`, `.cjs`, `.txt` or no extension alike — as a root input is
([file types](../command-line/file-types.md)); only a `.json` file is refused without it
(below). Node takes the format from the extension instead: it refuses `.txt`
and loads `.cjs` as CommonJS, where `export` is a syntax error, so a module
importing either compiles although Node would not load it. The existing
[module-resolution TODO](../../fjs/compiler/todo/module-resolution-compatibility.md)
records the host boundary, tests, and remaining support work.

A JSON document has only a `default` export. Both a default binding and
`{ default as name }` may select it; its object keys are not named exports.
The import requires the attribute JavaScript specifies and denotes the value
`JSON.parse` gives it:

```js
import a from "./a.json" with { type: "json" };
```

- The attribute is `with { type: "json" }`, spelled as JavaScript spells it:
  the key `type`, an identifier name, and the string `"json"`, in braces after
  the path. Any other key or value is an error, as it is in JavaScript. The
  value is a [string](../values/strings.md) like any other, so `type: 'json'` is the same
  attribute. JavaScript also accepts the key written as a string,
  `with { "type": "json" }`, a trailing comma after the pair, and `with {}`
  on an import that is not JSON; none of these is recognized yet. `"json"` is
  the one type ECMAScript defines; `"text"` and `"bytes"` are proposals,
  blocked on their standardization
  ([import-text-bytes](../../todo/blocked/import-text-bytes.md)).
- The attribute declares the file's language and never reinterprets the file,
  so it must agree with the extension: a `.json` file imported without it, and
  any other file imported with it, are errors — JavaScript refuses both, so
  that data a program did not declare cannot stand where it expects a module.
  The extension is that of the file the import resolves to, not the
  specifier's: under the Node profile a symlink's target decides, as it does
  in Node, so `"./alias.f.js"` linking to `data.json` needs the attribute,
  and `"./mod.json"` linking to `m.f.js` must not carry it.
- The document is read by the JSON reader, as a `.json` input is
  ([JSON input](../command-line/json-input.md)): a `.json` file is JSON and nothing more.

`fjs compile` resolves imports and inlines them, so its output is one
self-contained file that imports nothing.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#default_import>.

## Examples

The compiler demo offers the programs `imports` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [Imports](https://tc39.es/ecma262/#sec-imports)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import>
