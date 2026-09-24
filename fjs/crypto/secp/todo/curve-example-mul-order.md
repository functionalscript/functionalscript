## curve-example-mul-order. The `curve` doc example calls `mul` with its arguments swapped

**Priority:** P5
**Status:** open

### Problem

`Curve.mul` is `Fold<bigint, Point>` — the scalar first, then the point — and
`proof.f.mjs` calls it that way (`c.mul(3n)([1n, 1n])`). The `@example` on
`curve` in `fjs/crypto/secp/module.f.mjs` has them the other way round:

```js
const mulPoint = curveInstance.mul([1n, 1n])(3n); // Multiply a point by 3
```

A reader copying the example gets a type error, and without type-checking, a
point passed where a scalar belongs.

### Tasks

- [ ] Change the example to `curveInstance.mul(3n)([1n, 1n])`.

### Related

- PR [#2223 review](https://github.com/functionalscript/functionalscript/pull/2223#discussion_r4094540279)
  — found while renaming `Init.a`, kept out of that PR so it stays one change.
