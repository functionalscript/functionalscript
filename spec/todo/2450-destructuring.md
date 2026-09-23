# Destructuring Assignment

```js
const { "a": a, "%": [c, d] } = { "a": null, "%": [true, false] }
export default {
    "a": [a, c, d],
}
```

Depends on [const](../README.md#shared-values-constants) and [function parameters](../README.md#functions).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment.
