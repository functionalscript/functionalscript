# Destructuring Assignment

```js
const { "a": a, "%": [c, d] } } = { "a": null, "%": [true, false] }
export default {
    "a": [a, c, d],
}
```

Depends on [const](./2120-const.md) and [function parameters](./3120-parameters.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment.
