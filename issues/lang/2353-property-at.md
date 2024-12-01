# At

`a[42]`, `a['str']`, `a[+i]`.

```js
import m from './m.f.mjs'
const a = [2, 3]
export default {
    "a": a[0],
    // we don't know what is the type of `m` so we force it to be a `number` or `bigint`.
    "b": a[+m]
}
```

In `a[i]`, `i` has to be a `number` or known `string`, which is not equal to prohibited words, see [property-accessor](./235-property-accessor.md). If we don't know what is `i`, `+` requires before `i`.

Depends on [property-accessor](./2350-property-accessor.md).
