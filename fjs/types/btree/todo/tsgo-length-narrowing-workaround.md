## Remove the tuple-length workaround in `btree/set`

**Priority:** P4
**Status:** open

### Problem

`nodeSet` in [`../set/module.f.mjs`](../set/module.f.mjs) switches on a
tuple's `length` in two of its arms, and TypeScript 7 does not narrow that
length to a literal union there: an exhaustive `switch` on a co-narrowed
tuple's `.length` leaves the fallthrough reachable, where TypeScript 6 did not.
Both arms work around it by binding the length, asserting its two possible
values, and switching on the binding — each marked
"TODO: remove after TSGO fix the regression." The regression is reported
upstream as
[typescript-go#4613](https://github.com/microsoft/typescript-go/issues/4613),
which is closed; which release carries the fix is not recorded here yet.

The workaround costs a runtime `assert` per call in exactly the arms that need
none, and an extra binding the type system should not need.

### Tasks

- [ ] Find the typescript-go release that contains the #4613 fix.
- [ ] Once `typescript` in
      [`fjs/ci/config/module.f.mjs`](../../../ci/config/module.f.mjs) is at or
      past it, delete both `xL` bindings and their asserts in `nodeSet`, and
      switch on `x.length` directly.
- [ ] `tsc` clean with `noFallthroughCasesInSwitch` on; `fjs test`.

### Related

- [`todo/tsconfig-strict-flags.md`](../../../../todo/tsconfig-strict-flags.md)
  — the `noFallthroughCasesInSwitch` measurement that met this regression.
