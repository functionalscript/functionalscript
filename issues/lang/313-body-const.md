# Body Constants

Parse a function that has no parameters and returns a constant.

```js
export default {
    "a": () => {
        const x = 43
        return [3, x]
    },
    "b": [-42.5, false, "hello"]
}
```

Depends on [function](./311-function.md) and [const](./212-const.md).
