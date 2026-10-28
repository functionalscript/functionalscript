## A pure `or` cycle overflows the schema-form readers

**Priority:** P3
**Status:** open

### Problem

A schema that is an `or` of only itself, through any number of steps, sends
`validate` and `parse` into unbounded recursion: they throw `RangeError:
Maximum call stack size exceeded` rather than return a `Result`
([errors](../guide/readers/errors/README.md)). At `8892f739`:

```js
const orCycleA = () => ['or', orCycleB]
const orCycleB = () => ['or', orCycleA]
validate(rest([number], orCycleA))([1, 2]) // throws
parse(rest([number], orCycleA))([1, 2])    // throws
```

The data form reads the same schema and answers `error`, since
`toData(orCycleA)` is `never`. The crash shows up only once a value reaches
the cycle: with nothing past the prefix, `[1]`, all three readers answer `ok`,
which is the only form in which the acceptance table in
[`validate/proof.f.mjs`](../validate/proof.f.mjs) holds the schema.

### Tasks

- [ ] Decide whether an unguarded `or` cycle is a schema the readers owe an
  answer, or one to refuse where it is built, and make `validate` and
  `parse` agree with the data form either way.
