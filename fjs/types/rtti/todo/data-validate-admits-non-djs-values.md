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

Measured at `0d54eddd`, `ok` / `error` from each reader:

| schema | value | `validate` | `data.validate` |
| --- | --- | --- | --- |
| `{}` | `() => 1` | error | **ok** |
| `{}` | `Symbol()` | error | **ok** |
| `record(number)` | `() => 1` | error | **ok** |
| `record(number)` | `Symbol()` | error | **ok** |
| `{ a: number }` | `() => 1` | error | error |
| `array(number)` | `() => 1` | error | error |

The divergence is confined to object schemas that a property-free value
satisfies vacuously — the empty struct and `record`. A struct with a required
property rejects in both, because the property is missing; arrays and
primitives route correctly. So this is not a wholesale difference in what the
two readers mean, which is what makes it easy to miss.

`data.validate`'s own doc comment calls it "the counterpart of `../validate`",
so agreeing on acceptance is the contract, not an extra.

### Proposal

Make `data`'s dispatch reject what the thunk readers reject, rather than
treating "not a primitive, not an array" as "object". Guarding the final branch
with the same `isObject` used by `common` is the direct fix and keeps one
definition of what an object position accepts.

Worth deciding at the same time whether a non-DJS value should be an *error*
distinct from "unexpected value" — a function reaching a data position is
usually a different mistake from a shape mismatch, and the boundary work in
[rtti-type-system](../../../../todo/rtti-type-system.md) stage 13 is where such
values arrive.

### Tasks

- [ ] Route non-object, non-array, non-primitive values to a rejection in
      `unionValidate` rather than to object validation.
- [ ] Cover functions and symbols against `{}` and `record(...)` in tests, in
      both readers, so the two cannot drift apart again.
- [ ] Check `toData` and the other `data` entry points for the same
      assumption.

### Related

- [rtti-type-system](../../../../todo/rtti-type-system.md) — its **stage 4**
  proposes serializing a compile-time schema through `toData` and reusing that
  form at run time, to stop a stateful thunk from presenting different schemas
  in different phases. That remedy assumes the two readers accept the same
  values, so this issue gates it.
- [`../data`](../data/README.md) — the canonical function-free form.
