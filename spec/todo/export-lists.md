## Investigate export lists

**Priority:** P4
**Status:** open

### Problem

JavaScript can export existing bindings separately from their declarations:

```js
const x = 5;
export { x };
```

This syntax is separate from implemented [`export const`](../README.md#exporting-a-value).
Investigate the options and their usefulness before choosing what
FunctionalScript should support.

### Tasks

- [ ] Investigate local export lists, aliases such as `export { x as y }`,
      and `export { x as default }`. Identify concrete uses and compare them
      with declaration exports.
- [ ] Consider whether forms with `from` (re-exports) belong in the proposed
      scope or need a separate task.
- [ ] Describe the implications for binding resolution and the module result
      object, then propose a scope for owner review before implementation.

### Related

- [Named exports](../README.md#exporting-a-value).
