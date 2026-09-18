# Function Body

Parse a function with one expression.

```js
export default {
    "a": () => [3, 4],
    "c": () => ({ "a": 5 })
}
```

Depends on functions and on grouping, both implemented
([functions](../README.md#functions), [grouping](../README.md#grouping)) — the
grouping is what gives the object body of `"c"` its spelling.
