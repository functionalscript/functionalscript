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
[`fjs/types/object`](../../types/object/module.f.mjs)) — so a function or a symbol
fails it. `data`'s `unionValidate` instead dispatches on primitives and arrays
and lets **everything else** fall through to object validation:

```js
if (isArray(value)) { return patternsValidate(u.array, arraySetValidate(rules), value) }
return patternsValidate(u.object, objectSetValidate(rules), value)
```

A function or symbol therefore reaches object validation, and passes wherever
the object pattern accepts a value with no members of its own.

Measured at `11e9e10`, against `f = (a, b) => 1` and against a symbol (the two
agree on every row; `parse` agrees with `validate` on every row):

| schema | `validate` | `data.validate` |
| --- | --- | --- |
| `unknown` | ok | ok |
| `or(number, unknown)` | ok | ok |
| `{}` | error | **ok** |
| `record(number)` | error | **ok** |
| `or(number, {})` | error | **ok** |
| `or(option, {}, undefined)` | error | **ok** |
| `{ length: number }`, `{ name: string }`, `{ description: string }` | error | error |
| `{ a: number }`, `{ length: string }` | error | error |
| `array(number)` | error | error |

**The divergence is confined to patterns that declare no member.** An earlier
draft of this issue, measured at `1d25da6e`, found it wider: `objectSetValidate`
then read a declared property as `value[k]`, so a function's `length` and
`name` and a symbol's `description` satisfied `{ length: number }`,
`{ name: string }` and `{ description: string }`. It now reads through
`entry`, which does not see those intrinsics, so every struct with a required
member rejects a no-kind value in all three readers. What is left is `{}`,
`record(...)`, and the unions that contain one.

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

**The fix depends on a decision this issue does not own.** What an exported
`unknown` means is unsettled — the constructor's doc comment and the guide's
[primitives](../guide/schemas/primitives/README.md) page promise any DataJS
value, `Ts<>` excludes functions and symbols, both thunk readers have
`unknown: () => ok`, and the printer emits TypeScript's unrestricted `unknown`.
[rtti-type-system](../../../todo/rtti-type-system.md) records that
disagreement and gates stage 11 on resolving it. Which repair is correct here
follows from it:

- **if `unknown` keeps accepting every value**, the fall-through cannot simply
  be guarded, because it is what makes top accept a function at all — the guard
  would trade this divergence for its mirror image;
- **if `unknown` narrows to DataJS-compatible**, guarding it is right, and the
  thunk readers narrow to match.

**Beyond that split, the design needs investigation rather than a decision
here.** The questions that came up while measuring, none of them answered:
whether the encoding should represent values that belong to no kind at all
(which would make "all kinds" and "all values" the same set, and may be what
[668](668-rtti-function-types.md) needs anyway); whether a narrowed `unknown`
can be checked at all without recursive descent, given `object: true`
short-circuits in `patternsValidate` and carries no members to walk; and what
such a descent does on a cyclic input, since no reader has a visited-set today.

On that last point, one measured fact worth having before the investigation
starts: a cyclic value is not serializable as DataJS either —
[`fjs/media/datajs/serializer`](../../media/datajs/serializer/module.f.mjs)'s
`tryStringify` refuses a cycle by name, as it refuses every value outside the
data model. So "reject cycles" may be the honest answer
rather than a limitation, and the question is whether the readers should agree
with the serializer or be more permissive than it.

That last one connects to [identity-aware-parse](identity-aware-parse.md),
which needs input-keyed identity tracking for its own reasons. Whether one
mechanism serves both is worth establishing before either is built — but that
is an investigation, not a plan.

### Tasks

- [ ] **First**, settle what an exported `unknown` means — the decision
      [rtti-type-system](../../../todo/rtti-type-system.md) gates stage 11
      on. The repair below depends on it.
- [ ] Investigate the mechanism: no-kind representation versus explicit top,
      whether a narrowed `unknown` needs recursive descent, cycle handling if
      it does, and whether identity tracking here is the same mechanism
      [identity-aware-parse](identity-aware-parse.md) needs.
- [ ] Whatever lands, make the three readers agree, and cover functions and
      symbols in tests against `unknown`, `{}`, `record(...)`,
      `or(number, {})`, `or(option, {}, undefined)`, the required-property
      cases that used to diverge through the intrinsics (`{ length: number }`,
      `{ name: string }`, `{ description: string }`), and — if descent is
      adopted — nested and cyclic inputs.
- [ ] Check `toData`, `subset` and the other `data` entry points for the same
      "all kinds means all values" assumption.
- [ ] A future data-driven `parse` must reject a no-kind value exactly where
      `parse` does. Note that aligning *acceptance* is not sufficient for
      `parse`: `Data` canonicalizes branch order away, so
      `parse(or(open({ a: number }), open({ b: number })))({ a: 1, b: 2 })` is `{ a: 1 }`
      while the reversed union gives `{ b: 2 }` and the two `Data` values
      compare `equal`.

### Related

- [rtti-type-system](../../../todo/rtti-type-system.md) — its **stage 4**
  proposes serializing a compile-time schema through `toData` and reusing that
  form at run time, to stop a stateful thunk from presenting different schemas
  in different phases. That remedy assumes the two readers accept the same
  values, so this issue gates it.
- [`../data`](../data/README.md) — the canonical function-free form.
