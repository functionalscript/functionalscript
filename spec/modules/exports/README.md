# Exporting a Value

**Status:** implemented

This is a complete module:

```js
export default 5;
```

The module function returns an object of its exports: this module returns
`{ default: 5 }`. The default export is `5`, which a default import binds and
JSON/DataJS value output serializes. If the default export is an object, it
remains inside that property; its members do not become module exports.

Named constants are exports and local bindings:

```js
export const z = [5];
export const a = z;
export default a;
```

This module returns `{ a: z, default: z, z: z }`, with all three properties
sharing the same array. Export keys follow JavaScript namespace order
(lexicographic, including `default`). Initializers use the existing `const`
rules: earlier bindings are available, and duplicate bindings are errors.
The name `then` is reserved for exports, regardless of its value, and nowhere
else: a local `const`, a parameter or an import binding may be called `then`
([names](../../bindings/constants/README.md)).

Every other name a `const` may have can be exported, a built-in prototype's
included. The export object has no prototype — a JavaScript module namespace
has none — so `export const __proto__ = 7;` returns `{ ["__proto__"]: 7 }`, an
own property like any other export, and an importer selects it the same way
([importing](../imports.md)).

Unless a module ends in `throw`, at least one export is required
(`module exports nothing`): a `const` of a name exports it, and an exported
pattern exports each name it binds ([destructuring](../../bindings/destructuring/README.md)), so a
module whose only exports bind no name is refused at its last `export`.
A named-only module needs no default:
`export const a = 5;` returns `{ a: 5 }`. When present, `export default` is
**last**; only [trivia](../../lexical/whitespace/README.md) — whitespace,
newlines and comments — may follow it. Ordinary and exported
constants may appear together after all imports.

A default export can be any supported value:

```js
export default { "name": "fjs", "tags": ["data", "config"] };
```

`export default` alone already expresses everything JSON expresses — the value
that follows it is the module's default export. What takes a module past a
tree, and past what JSON can hold at all, is the rest of the language:
[constants](../../bindings/constants/README.md) and [imports](../imports.md)
name shared parts, and [`bigint`](../../values/README.md) and
[`undefined`](../../values/README.md) are values JSON has no spelling for.

`export { ... }` and re-exports remain unsupported. Export-list options are
tracked separately in [export-lists](../../todo/export-lists.md).

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export#using_the_default_export>.

## Examples

The compiler demo offers the programs `exports` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — a named export beside the default one
— with every output `fjs compile` makes of it: the expression graph (EDAG),
the Rust and the WebAssembly that Rust builds to. Its Run button calls the
default export with `1` and `2`, as JavaScript and as WebAssembly, and shows
what each call returned or threw.

```js
export const five = 5;
export default (...a) => five * a[0];
```

## Reference

- ECMA-262: [Exports](https://tc39.es/ecma262/#sec-exports)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export>
