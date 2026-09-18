# Undefined-Valued Properties

**Priority:** P1
**Status:** open

## Compatibility correction

The former unconditional rule `{ x: undefined } ≡ {}` is withdrawn. It was
based on direct reads and filtered serialization, which do not establish
substitutability in all admitted contexts. An ordinary JavaScript literal
still has an enumerable entry even when its value is `undefined`:

```js
Object.getOwnPropertyDescriptor({ x: undefined }, "x")?.enumerable; // true
Object.getOwnPropertyDescriptor({}, "x")?.enumerable; // undefined
```

The proposed [enumerable-presence pattern](./2345-has-own-property.md) exposes
that distinction. Prohibiting `Object.hasOwn` or `in` does not remove it, and
an internal VM definition cannot change the successful answer to the pattern.

## Explicit filtering

The existing proposed filtering patterns remain useful projections:

```js
Object.entries(a).filter(([, v]) => v !== undefined)
Object.values(a).filter(v => v !== undefined)
```

This TODO does not expand admission to bare enumeration. The important
correction is that equal filtered outputs do not make the inputs universally
equivalent. `JSON.stringify`'s omission of a property is likewise an output
choice, not permission to erase it before arbitrary computation.

## Construction and composition

```js
export default { x: 1, x: undefined }.x; // undefined, not 1
```

```js
const a = { x: undefined };
export default { x: 1, ...a }.x; // undefined; replacing a with {} gives 1
```

Even the filtered enumeration can distinguish insertion order:

```js
const a = { x: undefined };
export default Object.values({ ...a, y: 1, x: 2 })
    .filter(value => value !== undefined); // [2, 1], not [1, 2]
```

These are constraints on proposed features, not claims of current spread
support or a current stripping bug. Preserve overwrites and observable order;
normalize only where equivalence holds for every admitted observation.

## Tasks

- [x] Remove the unconditional equivalence and reconcile enumerable presence.
- [ ] Define and test any permitted normalization at its actual observation
      boundary, together with construction, composition and enumeration.
- [ ] Recheck that equivalence when adding a new operation or execution path.

## Related

- [VM-layer question](./1015-undefined-property-vm-layer.md).
- [Compatibility epic](../../todo/fjs-javascript-compatibility.md).
- [Blocked research](../../todo/blocked/undefined-removes-property.md) — ignored
  as an implementation direction while it remains blocked; not a prerequisite.
- `fjs/types/object/module.f.mjs` — `definedEntries` and `definedValues`.
