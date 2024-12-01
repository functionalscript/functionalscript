# Property Accessor

- `.`
- `[]`
- `?.`

**Note**: not all properties are allowed. Use [Object.getOwnPropertyDescriptor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor) functions instead.

[constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/constructor), [__proto__](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/proto) are not allowed, because:

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

Depends on [const](./212-const.md) and [default-import](./213-default-import.md).

See <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_accessors>.

## Function Call With Property Accessor

Operators `a.b()`, `a?.b()`.

```js
const x = a.b(5)
```

Not allowed (additional to `constructor` and `__proto__`):

- `__defineGetter__`
- `__defineSetter__`
- `__lookupGetter__`
- `__lookupSetter__`
- `toLocaleString` because it depends on locale, which is a side-affect.

Also, from a function:

- `apply`
- `bind`
- `call`

Also, from an array:

- `copyWithin`
- `entries` - returns an iterator. An iterator can be mutate by `.next()` or `for()`.
- `values` - returns an iterator.
- `keys` - returns an iterator.
- `pop`
- `push`
- `shift`
- `unshift`
- `sort`
- `reverse`
