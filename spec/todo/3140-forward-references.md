# 3.1.4. Forward References

**Priority:** P3
**Status:** open

Only forward objects are visible. Example:

```ts
const a = () => 5
const b = () => a() + 7 // ok
const c = b()            // ok
const d = d()            // error!
const e = () => e()      // ok
// two mutually recursive functions:
const f = () => h()      // not ok
const h = () => f()      // ok
// solution via object grouping:
const x = {
    a: () => x.b()       // ok
    b: () => x.a()       // ok
    c: () => x.rrrr()    // ok
}
```
