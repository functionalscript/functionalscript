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

A function or symbol therefore reaches object validation, and passes wherever
the object pattern happens to accept it — which is not only the vacuous case,
because `objectSetValidate` reads a declared property as `value[k]` and so sees
a function's `length` and `name` and a symbol's `description`.

Measured at `1d25da6e`:

Against `f = (a, b) => 1`:

| schema | `validate` | `data.validate` | `toData` kinds |
| --- | --- | --- | --- |
| `unknown` | ok | ok | `unit,number,string,bigint,array,object` |
| `or(number, unknown)` | ok | ok | `unit,number,string,bigint,array,object` |
| `{}` | error | **ok** | `object` |
| `record(number)` | error | **ok** | `object` |
| `or(number, {})` | error | **ok** | `number,object` |
| `option({})` | error | **ok** | `unit,object` |
| `{ length: number }` | error | **ok** | `object` |
| `{ name: string }` | error | **ok** | `object` |
| `{ length: number, name: string }` | error | **ok** | `object` |
| `{ a: number }` | error | error | `object` |
| `{ length: string }` | error | error | `object` |
| `array(number)` | error | error | `array` |

A symbol behaves the same way, through its own intrinsics:
`{ description: string }` diverges, `{ a: number }` does not.

Two things this shows that the one-line description does not.

**The divergence is not confined to vacuous patterns**, though an earlier draft
of this issue said it was. `objectSetValidate` reads each *declared* property as
`value[k]`, which does not require an object and does not care about
enumerability — so a required property diverges whenever the no-kind value
happens to carry one of that type. A function has `length` (number) and `name`
(string); a symbol has `description` (string). `Object.entries` is empty for
both, so the `rest` check never objects either.

The rule is therefore: **`data.validate` accepts a no-kind value for an object
pattern whenever every declared property reads to a conforming value and the
rest check passes vacuously** — which covers `{}`, `record(...)`, and any struct
whose declared properties the intrinsics happen to satisfy. `{ a: number }`
rejects only because a function has no `a`, and `{ length: string }` only
because `f.length` is a number. That is a much wider set than "the empty
struct", and it means a real schema can hit this: `{ name: string }` is an
ordinary shape to write.

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

**This is gated on what an exported `unknown` means**, which is not settled:
the module and its README promise DJS-compatible values, `Ts<>` excludes
functions and symbols, both thunk readers have `unknown: () => ok`, and the
printer emits TypeScript's unrestricted `unknown`.
[rtti-type-system](../../../../todo/rtti-type-system.md) records that
disagreement and gates stage 11 on resolving it. **Which repair is right here
follows from that decision**, so this issue must not settle it by choosing a
fix — an earlier draft of this section did exactly that, by requiring top to go
on accepting functions and symbols.

**If `unknown` keeps its current reader behaviour** (top accepts every value),
then guarding the final branch with `isObject` alone is wrong: it would make
`data.validate(toData(unknown))(() => 1)` reject where
`validate(unknown)(() => 1)` accepts, trading this divergence for its mirror
image. A fix then has to keep top accepting no-kind values while stopping
ordinary object sets from doing so, and there are two ways to get that:

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

**If `unknown` is narrowed to its documented DJS-compatible meaning**, the
repair points the other way: guard the fall-through with `isObject` **and**
narrow the thunk readers' `unknown` to match, so all three readers reject a
function or symbol.

**But that is not "much smaller", and an earlier draft of this section said it
was.** DJS-compatibility is a property of the *whole value*, and a root-level
guard only rejects a function that arrives as the root. `toData(unknown)`
renders the object branch as `object: true`, and `patternsValidate` returns
`ok(value)` immediately for `k === true`
([`data/module.f.mjs`](../data/module.f.mjs)) — it never descends. So
`{ nested: () => 1 }` would still be accepted, and narrowing only the root
would leave the mirror-image disagreement one level down instead of removing
it.

Narrowed `unknown` therefore needs a **recursive** check, which the current
representation cannot express: `true` is an unconstrained pattern carrying no
structure to descend into. That means either a data representation for
"any DJS value" that is recursive by construction, or a check that special-cases
the top and walks members anyway. Whichever, tests must cover **nested**
no-kind values, not only root ones.

**And recursive descent needs a cycle policy, stated before it is required.**
None of the readers tracks visited references today, so a walk that descends
into members will revisit a cyclic object indefinitely and overflow the stack —
the same defect the epic's stage 13 records for `parse` at the language
boundary, arrived at here from the opposite direction. Under the *current*
`unknown` this never arises, because the top short-circuits and never descends;
requiring recursion is what introduces it. So this option owes an explicit
choice — **reject a cycle** with a diagnostic, or **track identity** and treat a
revisited reference as already-checked — plus a cyclic-input test. Note that the
two choices are not interchangeable: identity tracking is also what
[identity-aware-parse](identity-aware-parse.md) needs for its own reasons, so
picking it here may pay for both.

That is why the decision has to come first. Building a function/symbol kind
under option 1 and then narrowing `unknown` later would leave a representation
designed for values the type language had decided not to admit.

Worth deciding at the same time whether a value with no kind should produce an
*error distinct from* "unexpected value" — a function reaching a data position
is usually a different mistake from a shape mismatch, and the boundary work in
[rtti-type-system](../../../../todo/rtti-type-system.md) stage 13 is where such
values arrive.

### Tasks

- [ ] **First**, settle what an exported `unknown` means — the decision
      [rtti-type-system](../../../../todo/rtti-type-system.md) gates stage 11
      on. Everything below depends on it.
- [ ] If `unknown` keeps accepting every value: decide between representing
      no-kind values and marking top explicitly, then make `unionValidate`
      reject a no-kind value for an ordinary object set while still accepting
      it for the canonical top.
- [ ] If `unknown` narrows to DJS-compatible: guard the fall-through with
      `isObject`, narrow both thunk readers' `unknown` to match, **and** make
      the check recursive — `object: true` short-circuits in
      `patternsValidate`, so a root-only guard still accepts
      `{ nested: () => 1 }`. Cover nested no-kind values in the tests, not just
      root ones.
- [ ] If that recursive check is adopted, **decide the cycle policy first** —
      reject, or track visited references — since no reader has a visited-set
      today and descending without one overflows the stack on a cyclic input.
      Add a cyclic-input test alongside the nested ones.
- [ ] Cover functions and symbols in tests against `unknown`, `{}`,
      `record(...)`, `or(number, {})` and `option({})`, in **both** readers, so
      neither the divergence nor its mirror image can return.
- [ ] Cover **required-property** schemas the intrinsics satisfy —
      `{ length: number }` and `{ name: string }` for a function,
      `{ description: string }` for a symbol — plus the near misses that must
      keep rejecting (`{ a: number }`, `{ length: string }`). A test matrix
      built only from vacuous patterns would pass over the case a real schema
      is most likely to hit.
- [ ] Check `toData`, `subset` and the other `data` entry points for the same
      "all kinds means all values" assumption.
- [ ] Whatever is decided here has to hold for **`parse` too**, and `data` has
      no `parse` and no `Data`-to-`Type` reconstruction today. If one is added
      (see [rtti-type-system](../../../../todo/rtti-type-system.md) stage 4),
      it must reject a no-kind value exactly where `parse` does now — otherwise
      this divergence is simply recreated in the second reader.

      Aligning *acceptance* is not sufficient for `parse`, either, because
      `Data` does not preserve what `parse` returns: it reconstructs from the
      first matching branch, and `toData` canonicalizes branch order away.
      `parse(or({ a: number }, { b: number }))({ a: 1, b: 2 })` is `{ a: 1 }`
      while the reversed union gives `{ b: 2 }`, and the two `Data` values
      compare `equal`. A data-driven `parse` has to decide what it returns
      there — a design question this issue does not settle.

### Related

- [rtti-type-system](../../../../todo/rtti-type-system.md) — its **stage 4**
  proposes serializing a compile-time schema through `toData` and reusing that
  form at run time, to stop a stateful thunk from presenting different schemas
  in different phases. That remedy assumes the two readers accept the same
  values, so this issue gates it.
- [`../data`](../data/README.md) — the canonical function-free form.
