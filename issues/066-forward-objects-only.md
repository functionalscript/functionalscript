# 66. Only forward objects are visible.

**Priority:** P3
**Status:** open

Example:
```ts
const a = () => 5
const b = () => a() + 7 // ok
const c = b() // ok
const d = d() // error!
const e = () => e() // ok
// two recursive functions:
const f = () => h() // not ok
const h = () => f() // ok
// how to solve the two recursive functions case:
const x = {
    a: () => x.b() // ok
    b: () => x.a() // ok
    c: () => x.rrrr() // ok
}
```
