## data-validate-admits-non-djs-values. `data.validate` accepts functions and symbols where the thunk readers reject them

**Priority:** P3
**Status:** open

### Problem

[`data`](../data/README.md)'s reader and the thunk readers
([`validate`](../validate/module.f.mjs), [`parse`](../parse/module.f.mjs))
disagree about values that are neither primitives nor arrays nor plain objects.
The thunk readers guard object positions with `isObject`, which is
`typeof value === 'object' && !isArray(value) && value !== null`
([`common`](../common/module.f.mjs), via
[`fjs/types/object`](../../object/module.f.mjs)) — so a function or a symbol
fails it. `data`'s `unionValidate` instead dispatches on primitives and arrays
and lets **everything else** fall through to object validation:

```js
if (isArray(value)) { return patternsValidate(u.array, arraySetValidate(rules), value) }
return patternsValidate(u.object, objectSetValidate(rules), value)
```

A function or symbol therefore reaches object validation, and passes wherever a
value with no own enumerable entries passes vacuously.

Measured at `b47b1376`:

| schema | `validate` | `data.validate` | `toData` kinds |
| --- | --- | --- | --- |
| `unknown` | ok | ok | `unit,number,string,bigint,array,object` |
| `or(number, unknown)` | ok | ok | `unit,number,string,bigint,array,object` |
| `{}` | error | **ok** | `object` |
| `record(number)` | error | **ok** | `object` |
| `or(number, {})` | error | **ok** | `number,object` |
| `option({})` | error | **ok** | `unit,object` |
| `{ a: number }` | error | error | `object` |
| `array(number)` | error | error | `array` |

A symbol behaves exactly as the function does in every row.

Two things this shows that the one-line description does not.

**The divergence is confined to object patterns a value with no own enumerable
entries satisfies vacuously.** `{ a: number }` rejects in both, because the
property is missing; arrays and primitives route correctly. So the readers
agree on any schema with a required property, which is what makes the
disagreement easy to miss when spot-checking.

**And it is not simply "`data` is too permissive".** For `unknown` the readers
*agree*, and they agree **because** of the fall-through: the thunk reader
implements `unknown` as `() => ok`, and `data` reaches the same answer only by
routing the function to the top object set. So the fall-through is load-bearing
for the one schema where accepting a function is correct.

The root cause is in the encoding, not the dispatch. `toData` renders `unknown`
as the union of every *kind* — and a function or a symbol belongs to **no**
kind. "All kinds" is therefore a strictly smaller set than "all values", so the
canonical top does not round-trip, and `unionValidate`'s fall-through is what
accidentally repairs it. It repairs top and breaks every other object set.

`data.validate`'s own doc comment calls it "the counterpart of `../validate`",
so agreeing on acceptance is the contract, not an extra.

### Proposal

**Do not simply guard the final branch with `isObject`.** That is the obvious
fix and it is wrong: it would make `data.validate(toData(unknown))(() => 1)`
reject where `validate(unknown)(() => 1)` accepts, trading this divergence for
its mirror image. Any fix has to keep top accepting values that have no kind
while stopping ordinary object sets from doing so.

Two ways to get that, and the choice is about how the top is represented:

1. **Give values with no kind a representation.** Add function and symbol kinds
   (or a single "other" kind), so the union genuinely denotes a set of values
   rather than a set of kinds and `unknown` means all of them. `unionValidate`
   then dispatches such a value to that kind, and the fall-through can be
   guarded with `isObject` safely. This makes the encoding honest and is the
   direction that also serves
   [668](668-rtti-function-types.md), which will need functions describable
   in some form.
2. **Mark the canonical top explicitly**, distinct from "every kind is set", and
   accept any value there while guarding the fall-through with `isObject`
   elsewhere. Smaller, but it keeps an encoding in which "all kinds" silently
   means something narrower than "all values", so the next reader of this code
   meets the same trap.

Worth deciding at the same time whether a value with no kind should produce an
*error distinct from* "unexpected value" — a function reaching a data position
is usually a different mistake from a shape mismatch, and the boundary work in
[rtti-type-system](../../../../todo/rtti-type-system.md) stage 13 is where such
values arrive.

### Tasks

- [ ] Decide between representing no-kind values and marking top explicitly.
- [ ] Make `unionValidate` reject a no-kind value for an ordinary object set
      while still accepting it for the canonical top.
- [ ] Cover functions and symbols in tests against `unknown`, `{}`,
      `record(...)`, `or(number, {})` and `option({})`, in **both** readers, so
      neither the divergence nor its mirror image can return.
- [ ] Check `toData`, `subset` and the other `data` entry points for the same
      "all kinds means all values" assumption.

### Related

- [rtti-type-system](../../../../todo/rtti-type-system.md) — its **stage 4**
  proposes serializing a compile-time schema through `toData` and reusing that
  form at run time, to stop a stateful thunk from presenting different schemas
  in different phases. That remedy assumes the two readers accept the same
  values, so this issue gates it.
- [`../data`](../data/README.md) — the canonical function-free form.
