# 77. Support for property accessor.

Support for [./lang/2330-property-accessor.md](./lang/2330-property-accessor.md).
```js
const a = { b: 45, c: [3] }
// Operator:
// `instant_property(a, "b")`
const c0 = a.b
// Only strings are allowed excluding a list of specific strings. Operator:
// `instant_property(a, "c")`
const c1 = a["c"]
// Operator:
// `at(c1, +0)`
const c2 = c1[+0] // [+...] is allowed.
// translated into one operator:
// `own_property(a, c2)`
const c3 = Object.getOwnPropertyDescriptor(a, c2)?.value
```
