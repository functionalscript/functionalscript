## Bug: the FJS compiler mishandles `__proto__` keys

**Priority:** P2
**Status:** open
**Blocked by:** computed property keys — see
[proto-property-key](./proto-property-key.md)

The rule and its rationale are in
[proto-property-key](./proto-property-key.md); this issue is the state
of the current implementation and what to change in it.

### Part 1 — serializing (emitting)

**The DJS serializer emits the prototype-assigning spelling**, so it
does not round-trip its own output:

```js
import { stringifyAsTree } from './fjs/djs/serializer/module.f.mjs'
import { sort } from './fjs/types/object/module.f.mjs'

const o = {}
Object.defineProperty(o, '__proto__',
    { value: 3, enumerable: true, writable: true, configurable: true })

stringifyAsTree(sort)(o)          // '{"__proto__":3}'
eval('({"__proto__":3})')         // {} — the property is gone
```

With an object value the failure is worse than lossy: the emitted text
replaces the prototype, producing a different value rather than an
incomplete one.

**Cause.** `propertySerialize` in
[`fjs/djs/serializer/module.f.mjs`](../fjs/djs/serializer/module.f.mjs)
builds a key with `stringSerialize` + `colon` borrowed from
[`fjs/media/json/serializer/module.f.mjs`](../fjs/media/json/serializer/module.f.mjs).
That is correct for JSON and wrong for JavaScript — the two languages
disagree about this one key.

**Scope — the JSON serializer is correct and must not change.**
`JSON.parse('{"__proto__":3}')` yields an own property, so JSON already
round-trips; `["__proto__"]:` is not even valid JSON. Only the DJS
emitter (the `.f.js` module path, `stringify` / `stringifyAsTree` via
[`fjs/djs/module.f.mjs`](../fjs/djs/module.f.mjs)) needs the computed
spelling. Fixing this in the shared JSON helper would break JSON output.

- [ ] `propertySerialize` in the **DJS** serializer emits
      `["__proto__"]:` for that key and `"k":` for every other.
- [ ] Round-trip proof: serialize → evaluate → structurally equal, with
      `__proto__` in the corpus, both as a primitive and as an object
      value.
- [ ] Leave the JSON serializer alone; add a test asserting JSON output
      keeps `"__proto__":`, so a later refactor cannot "unify" the two.

### Part 2 — parsing

The parser accepts both prototype-assigning spellings today.
`parseObjectStartOp` in
[`fjs/djs/parser/module.f.mjs`](../fjs/djs/parser/module.f.mjs) takes a
key from either a `string` or an `id` token (the identifier-property
path, `#2410`) and hands it to `pushKey` unchecked, so
`{ __proto__: v }` and `{ "__proto__": v }` both parse as an ordinary
key — the parser's meaning and JavaScript's disagree.

- [ ] Reject the `id` spelling `{ __proto__: … }` with a compilation
      error.
- [ ] Reject the string spelling `{ "__proto__": … }` likewise.
- [ ] Accept `{ ["__proto__"]: … }` — needs computed property keys,
      which the language does not have yet, hence the **Blocked by**
      above. The two rejections are not blocked and can land first.
- [ ] Parser proof covering all three spellings.

### Why both halves matter

Until part 1 lands, the compiler can produce a module whose meaning
differs from the value it was given. Until part 2 lands, it can accept a
module whose meaning differs from what JavaScript gives it. Each half is
a soundness gap on its own side of the pipeline.
