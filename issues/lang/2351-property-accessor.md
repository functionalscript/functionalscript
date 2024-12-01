# Property Accessor

- `.`
- `?.`

**Note**: not all properties are allowed. Use [Object.getOwnPropertyDescriptor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor) functions instead.

[`constructor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/constructor), [`__proto__`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/proto) are not allowed, because:

```js
const f = (() => {}).constructor
const g = f(`console.log('hello')`)
g()
```

```js
const p = (() => {}).__proto__
const f = Object.getOwnPropertyDescriptor(p, 'constructor').value
const g = f(`console.log('hello')`)
g()
```

## Example

```js
const a = { x: 3}
export default a.x
```

Depends on [const](./2120-const.md), [default-import](./2130-default-import.md) and [undefined](./2310-undefined.md).

See <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_accessors>.
