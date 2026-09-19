# Function Parameters

Parse a function whose parameters are named, one per parameter.

```js
export default (a, b) => { return [a, b] }
```

Depends on functions, which are in the language with the one rest parameter
and with no parameter at all ([functions](../README.md#functions)). What is
left is the named list, which the grammar's `parameters` rule is where to
put: it already decides between `...a` and nothing at the one symbol after
the `(`, and a named list is a third branch there.
