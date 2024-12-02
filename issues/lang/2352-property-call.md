# Function Call With Property Accessor

Operators `a.b()`, `a?.b()`.

```js
const x = a.b(5)
```

For `null?.b(x())`. We follow the same behavior as JS, so the `x` function will not be called.

Not allowed (additional to `constructor` and `__proto__`, see [property-accessor](./2351-property-accessor.md)):

- `__defineGetter__`
- `__defineSetter__`
- `__lookupGetter__`
- `__lookupSetter__`
- `isPrototypeOf` FS has no prototype concept because it has no inheritance.
- `toLocaleString` because it depends on the locale, which is a side-effect.

Also, from a function:

- `apply`
- `bind`
- `call`

Also, from an array:

- `copyWithin`
- `entries` - returns an iterator.
- `values` - returns an iterator.
- `keys` - returns an iterator.
- `pop`
- `push`
- `shift`
- `unshift`
- `sort`
- `reverse`

FunctionalScript doesn't allow direct access to iterators. An iterator can be mutated by `.next()` or `for()`. Indirect access to iterators is allowed through the `Iterable` interface. For example 
```js
for (const i of [1, 2]) { }
```
In this example, the loop gets a temporary iterator from the iterable interface of `[1, 2]` then use it and discard it. A user can't have direct access to the iterator and can't make a copy of it. 
