# Function Body

Parse a function with one expression.

```js
export default {
    "a": () => [3, 4],
    "c": () => ({ "a": 5 })
}
```

Depends on [function](./3110-function.md); grouping is implemented
([grouping](../README.md#grouping)), which is what gives the object body of
`"c"` its spelling.
