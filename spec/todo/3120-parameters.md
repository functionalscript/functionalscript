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

The unchanged dependency-free `fjs/types/range/module.f.mjs` is the first
repository migration candidate. After `export const` support, FSC reaches
`10:27` and refuses the comma in `(b, e)`:

```js
export const contains = (b, e) => i => b <= i && i <= e
```

The source remains `.f.mjs` and unchanged. The owner decides whether to rewrite
it or implement this feature; named parameters alone do not establish that the
rest of the file compiles. Retry the original file after the selected change and
report the next diagnostic before expanding scope.
