## The "global name to prototype list" table is written three times

**Priority:** P4
**Status:** open

### Problem

`prototypes` in [`fjs/edag/value/method`](../../../edag/value/method/module.f.mjs):

```js
const prototypes = { Object: objectPrototype, Array: arrayPrototype, String: stringPrototype,
    Number: numberPrototype, Boolean: booleanPrototype, BigInt: bigintPrototype, Function: functionPrototype }
```

and `types` in [`fjs/nanvm/methods`](../../../nanvm/methods/module.f.mjs) are
the same seven pairs in the same order, each importing the seven lists
separately; [`module.f.js`](../module.f.js) itself holds a third, private copy
as `lists`, to derive `prototypeNames`.

### Proposal

Export the ordered table from this module, derive `lists` and
`prototypeNames` from it, and have `value/method` (`admits`, the key type of
`typeName`) and `nanvm/methods` (`types`, `rows`) import it.

### Tasks

- [ ] Export `prototypes`; rewrite the two copies and the local `lists` over
      it.

### Related

- [`fjs/js/todo/runtime-members`](../../todo/runtime-members.md) — retires
  `value/method`'s dispatcher later, which removes one copy; the other two
  stay.
