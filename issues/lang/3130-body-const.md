# Body Constants

Parse a const definition in a function body; a const can be used within that body after it is defined.

```js
export default () => {
    const x = 43
    return [3, x]
}
```

Depends on [function](./3110-function.md) and [const](./2120-const.md).
