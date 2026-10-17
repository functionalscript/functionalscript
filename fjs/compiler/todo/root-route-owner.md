## The JSON-root route and the JSON module shape are written in the linker and the interpreter

**Priority:** P3
**Status:** open

### Problem

[`source`](../source/module.f.mjs) owns the one module walk — `_rootSource`,
`_parseJson`, `_walk` — as
[load-modules-without-import-effect](./load-modules-without-import-effect.md)
asked. Around it, its two callers restate the same two decisions. The root
route, "a `.json` root is a document, a module root is walked":

```js
// compiler/edag resolve
export const resolve = path => step(_rootSource(path), source => source.json
    ? mapStep(_parseJson(source.path), jsonValue)
    : mapStep(_walk(linking)(source)({ complete: null, stack: null }), ([, { exports }]) => exports))
// transpiler interpretSource
const interpretSource = runtime => source => source.json
    ? mapStep(_parseJson(source.path), jsonValue)
    : mapStep(_walk(interpreting(runtime))(source)({ stack: null, complete: null }), ([, value]) => value)
```

and the JSON import's module shape, `['{}', [[':', 'default',
jsonValue(value)]]]`, in `linking.json` and `interpreting.json`. The
transpiler adds `interpretLoaded` to run its runtime `load` only for a module
root, a third statement of the same route.

### Proposal

In `source`: `_jsonModule(value)`, the `{ default }` module both loads build;
the empty walk context as a constant; and `_program(loader)(path)`, the route
— a JSON root parsed, a module root walked with the `_Load` the `loader`
effect yields, so the transpiler's runtime is loaded only when a module needs
it. `resolve` is `mapStep(_program(pureOk(linking))(path), ({ exports }) =>
exports)`; `interpret` is `_program(mapStep(load, interpreting))`;
`interpretSource` and `interpretLoaded` go, and neither caller names
`_parseJson` or the context.

### Tasks

- [ ] `_jsonModule`, the context and `_program` in `source`, with proof.
- [ ] `compiler/edag` and `transpiler` route through them.

### Related

- [load-modules-without-import-effect](./load-modules-without-import-effect.md)
  — "do not introduce a second resolution walk"; this is the residue around
  the one walk.
- [interpret-edag](./interpret-edag.md) — records the readers' move into
  `source`.
