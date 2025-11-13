# Investigate Mutability Inference

```ts
const s = [] // mutable
const f = () => { // the function can be called only if s is mutable.
    s.push(3)     // s is mutable.
}
```

## Circular References

```ts
const s = [] //
const m = [] //
s.push(m)    // ok, but now `m` is immutable
m.push(s)    // error: `m` is immutable
```
