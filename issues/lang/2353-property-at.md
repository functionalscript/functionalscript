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

In `a[i]`, `i` has to be a `number` or known `string`, which is not equal to prohibited words, see [property-accessor](./2351-property-accessor.md). If we don't know what is `i`, `+` requires before `i`.

It means that the byte code for the expression inside the `[]` should be either the unary `+`, a number literal, or a string literal (excluding some strings). If it references an object, FS gives up. In the future, FS may try deeper analyses and type inference can help a lot.

Depends on [property-accessor](./2351-property-accessor.md).
