## The value constructors take thunks every caller wraps evaluated values in

**Priority:** P3
**Status:** open

### Problem

`array` in [`array`](../array/module.f.mjs), `object` in
[`object`](../object/module.f.mjs), `func` in
[`function`](../function/module.f.mjs) and `prepare`/`call` in
[`call`](../call/module.f.mjs) take deferred operands — `ValueThunk`,
`ObjectItems`, a `callee: ValueResult`. Their consumers outside proofs,
[`fjs/edag/operations`](../../operations/module.f.mjs) and the dispatchers
under `value/`, already hold evaluated values and wrap them to fit:

```js
// operations: items, one single-item array(...) per item inside its own loop
const resolved = array([spread ? ['...', () => result] : () => result])
// operations: =>, callValue, intrinsicCall
func(length, value[1].map(v => () => ok(v)), expression(body))
prepare(ok(callee), value[1].map(v => () => ok(v)))
call(ok(own[2]), args.map(v => () => ok(v)), invoke)
// value/method: callee
call(ok(dot), [() => ok(receiver), () => ok(key)], invoke)
```

[`array_method`](../array_method/module.f.mjs) keeps a private `apply` that
is this wrapper named; the other sites re-spell it inline. No call site passes
a callee that is not `ok(...)` and no thunk that is not `() => ok(v)`, so
`prepare`'s error-callee branch and the laziness are reached by proofs alone.
Likewise `sequence` and `conditional` in [`control`](../control/module.f.mjs)
have no importer but their proof: `operations` implements `,` with its own
loop and `?:` by choosing the branch to evaluate.

### Proposal

Value-taking constructors. Operand evaluation order and failure
short-circuiting stay in `operations`, which already does them:

```ts
array: (items: readonly (EdagValue | readonly ['...', EdagValue])[]) => Result<ValueArray, EdagValue>
object: (items: readonly (Property | readonly ['...', EdagValue])[]) => Result<ValueObject, EdagValue>
func: (length: number, captures: Values, template: Exp) => Closure
prepare: (fn: EdagValue, args: Values) => Outcome
call: (fn: EdagValue, args: Values, invoke: Invoke) => ValueResult
```

`ValueThunk`, `PropertyThunk` and `ObjectItems` go from the `types.ts` files,
with `array_method`'s `apply`, the per-item `array([...])` trick in
`operations.items`, the dead error-callee branch of `prepare`, and the two
unused `control` exports and their proofs. The [README](../README.md)'s "from
deferred items" rows are reworded.

### Tasks

- [ ] Change the five constructors and their proofs.
- [ ] Rewrite the wrapping sites in `operations`, `method`, `array_method`,
      `property` and `coercion`.
- [ ] Delete the thunk types and the unused `control` exports.

### Related

- [`fjs/edag/todo/helper-node-table`](../../todo/helper-node-table.md) — the
  `length` ladders in `prepare` and `property.read`; a different duplication
  in the same functions.
