# Function Call With Property Accessor

Operators `a.b()`, `a?.b()`.

```js
const x = a.b(5)
```

Not allowed (additional to `constructor` and `__proto__`, see [property-accessor](./2351-property-accessor.md)):

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
- `entries` - returns an iterator. An iterator can be mutated by `.next()` or `for()`.
- `values` - returns an iterator.
- `keys` - returns an iterator.
- `pop`
- `push`
- `shift`
- `unshift`
- `sort`
- `reverse`

Functional script doesn't allow direct access to iterators.
