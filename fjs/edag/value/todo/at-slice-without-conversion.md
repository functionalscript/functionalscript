## `at` and `slice` convert what their one caller already converted

**Priority:** P4
**Status:** open

### Problem

[`at`](../at/module.f.mjs) and [`slice`](../slice/module.f.mjs) each begin
with `primitiveToNumber` over their index operands, and document a contract
for it ("bigint indices fail even for empty receivers"). Their only importer,
`arrayMethod` in [`array_method`](../array_method/module.f.mjs), calls them
with an array receiver only, and only after `toNumber` has already produced a
`number`:

```js
// arrayMethod
const result = toNumber(first, invoke)
… if (key === 'at') { return at(receiver, number) }
… return endKind === 'error' ? end : slice(receiver, number, last)
```

So the bigint-refusal arms and the second conversion are unreachable from the
interpreter, and the string arms (`typeof receiver === 'string' ? receiver :
receiver[1]`, `receiver.slice(first, last)`) are reached by proofs alone. The
string dispatcher, `stringMethod` in [`method`](../method/module.f.mjs), does
that work inline instead: `case 'at': { return ok(tagUndefined(receiver.at(index))) }`
and `receiver.slice(index, last)`.

### Proposal

`at(receiver: ValueArray | string, index: number)` and
`slice(receiver: ValueArray | string, start: number, end: number | undefined)`
with no primitive conversion — conversion stays with `toNumber` in the
dispatchers — called from both `arrayMethod` and `stringMethod`. The two
modules either shrink to that or fold into one. The conversions, the
`untagUndefined(end)` decoding, their bigint and `['undefined']` proof cases,
the inline string arms, and the "bigint fails even for empty receivers"
contract in both module headers and the [`fjs/edag` README](../../README.md)
go.

### Tasks

- [ ] Narrow `at` and `slice` to numeric operands; call them from
      `stringMethod`.
- [ ] Delete the conversions, their proofs and the contract text.

### Related

- [`fjs/js/todo/runtime-members`](../../../js/todo/runtime-members.md) —
  moves built-in bodies into `js/runtime` eventually; this is the double
  conversion, wherever the bodies live.
