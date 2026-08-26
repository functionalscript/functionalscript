# `close` splits one value into a member and a non-member

**Priority:** P2 — `close(c, never)` and `close(c)` are one set that the three
readers answer differently, which is a defect rather than a decision; the
decision it sits inside is P3
**Status:** open — one reader disagreement to fix, then a choice between two
correspondences the module cannot currently both keep

## Problem

RTTI has one rule for absence, stated in [`../README.md`](../README.md) for
both container kinds: an absent member reads as `undefined`, so **a member is
required exactly when its set excludes `undefined`**. Absence and `undefined`
are one thing — which is why `[number, option(string)]` accepts `[42]`, and why
[#1712](https://github.com/functionalscript/functionalscript/pull/1712) settled
a hole in a *schema* the same way: reading the position yields `undefined`, so
that is what it declares.

`close` does not extend the rule past the declared positions, so three
spellings of one value part company there. Measured at `be345a7`, `validate`,
`parse` and the data form agreeing on every cell:

| schema | `[1]` | `[1, undefined]` | `[1, ,]` (a hole) |
| --- | --- | --- | --- |
| `[number]` | ok | ok | ok |
| `close([number])` | ok | **error** | **error** |
| `close([number, option(string)])` | ok | ok | ok |
| `close([number], () => ['const', undefined])` | ok | ok | ok |

Rows 1 and 3 apply the rule, and row 3 applies it *inside* a closed container,
so this is not "closing is stricter" — a **declared** position admitting
`undefined` may be absent, present-as-`undefined`, or a hole, all one value.
Row 4 is not the missing spelling either: it states a different set, admitting
every longer run of `undefined`. Row 2 is where the three part.

### The two rejections are not the same rejection

`closeContainerValidate` ends in `extra.length === 0 && fits(...)`
([`../validate/module.f.mjs`](../validate/module.f.mjs)), and `&&`
short-circuits, so the two halves catch different values:

```
[1, undefined]  Object.entries -> [['0',1],['1',undefined]]  extra=[['1',undefined]]  -> the extra check
[1, ,]          Object.entries -> [['0',1]]                  extra=[]                 -> fits
```

An explicit trailing `undefined` **is** an own enumerable entry, so it is an
undeclared member held to an absent `rest` — which is exactly what
[`../README.md`](../README.md) says `close` does, and it is right about it. A
hole is no entry at all, so `undeclaredEntries`
([`../common/module.f.mjs`](../common/module.f.mjs)) finds nothing and only
`fits` — `value.length <= declared` — rejects it. Patching both tuple `fits` to
`() => true` settles which is which: `[1, undefined]` still errors, the hole
flips to `ok`.

The data form says the same thing in the same two halves —
`extra.length === 0 && value.length <= pn` in `arraySetValidate`
([`../data/module.f.mjs`](../data/module.f.mjs)) — which is why all three
readers agree cell for cell on every schema above.

### A defect falls out, and it has to be fixed whichever answer wins

Both length checks sit in the **no-`rest`** branch. Supplying a `rest` skips
them, and a hole is no entry, so it meets nothing on the way through — while
the data form, which reads a normalized set rather than the spelling, still
applies its own. `never` is a public spelling of the exact-members set, and
`close(c)` and `close(c, never)` normalize to the identical `Data`, so the two
must be one schema. They are not:

| schema | `[1]` | `[1, undefined]` | `[1, ,]` (a hole) |
| --- | --- | --- | --- |
| `close([number])` | ok / ok / ok | error / error / error | error / error / error |
| `close([number], never)` | ok / ok / ok | error / error / error | **ok / ok / error** |

(`validate` / `parse` / data form; `cmp` reports the two `toData` results
equal.) That is a reader disagreement of exactly the kind
[#1712](https://github.com/functionalscript/functionalscript/pull/1712) fixed,
not a design choice: whichever of A, B or C is chosen, one spelling of a set
cannot accept what another rejects. It is listed first in the tasks for that
reason, and it means **B is not documentation-only**.

The narrow fix is **not** to consult `fits` on both branches: `fits` is
`value.length <= declared`, so applying it wherever a `rest` is present would
reject every value the `rest` exists to admit — `close([number], string)`
would stop accepting `[1, 'x']`, which all three readers take today.

It is to **normalize an empty `rest` to no `rest`**, which is what `toData`
already does and why the two disagree in the first place:

```
toData(close([number]))         {"array":[{"prefix":[{"number":true}]}]}
toData(close([number], never))  {"array":[{"prefix":[{"number":true}]}]}   ← no rest
```

The data form has already dropped the empty `rest` by the time it validates, so
it takes the length bound; the schema-form readers still see `rest !== undefined`
and skip it. Dropping an empty `rest` in `closeContainerValidate` and
`closeContainerParse` before the branch makes `close(c, never)` *be*
`close(c)`, which is what the README already says it is, and leaves every
non-empty `rest` untouched. A `rest` of `unknown` normalizes to the open form
and is unaffected either way.

The alternative — validate a trailing hole against the `rest`, reading it as
`undefined` — also reconciles the two, but it is a wider change: it would move
`close([number], string)` against `[1, ,]` from ok to error in all three
readers, where they agree today.

So exactly one case rests on `length`, the attribute the absence rule says
stops being observable after the last required position. The other rests on
counting a present-but-`undefined` member as a member — defensible, but it is
the same question one step in, since the rule says that member *is* absence.

### The length half has a stated defence

It is not an oversight, and the argument is already written down, in that same
function:

> a hole past it is not an entry, but the array is still that long, and this is
> the set `Ts<>` renders as a tuple of exactly `pn` positions and JSON Schema
> as `items: false`

That is the real cost of moving either half: `Ts<close([number])>` is
`readonly[number]`, which no length-2 array inhabits however its second element
is spelled, and `items: false` says the same to a JSON Schema consumer. Drop
the length check and the closed tuple's value set stops matching both of its
own renderings.

So the decision is not "fix an inconsistency" but a choice between two
correspondences the module currently cannot both keep: **absence is
`undefined`** (the README's rule, which the length check breaks) and **the set
is what it renders as** (which dropping it breaks).

## Who depends on the answer

`or(close(short), close(long))` is the only way to state an optional trailing
operand that rejects a present-but-`undefined` slot, and it rejects it through
the extra check: position 3 is undeclared in the short alternative, and not a
`propertyLambda` in the long one. So a consumer that wants **one spelling per
value** — where a second spelling is a second hash — depends on the answer
here.

[`../../../edag`](../../../edag/README.md) is the sole consumer of `close`
outside this directory, and it states its uniqueness claim as literal:

> "Exactly one" is literal rather than "up to trailing junk", because every
> tuple in the schema is `close`d — `['.', a, 'b', null, 'extra']` does not
> validate.

Against the landed schema, the values following the canonical
`['.', a, 'b', null]` divide two-to-one:

| value | `validate(exp)` | rejected by |
| --- | --- | --- |
| `['.', a, 'b', null, 'extra']` | error | the extra check — the README's reason |
| `['.', a, 'b', null, undefined]` | error | the extra check — the same reason |
| `['.', a, 'b', null, ,]` | error | `fits`, on `length` |

The sentence is accurate for two of the three. Only the hole is held by a
mechanism it does not describe, and under an answer that reads a hole as
absence it would stop being held at all — leaving one node with two spellings
and two hashes.

**A declared `option` position is *not* governed by this issue.** Row 3 above
already accepts `[1]` and `[1, undefined]` alike, and so would
`close(['.', exp, index, option(propertyLambda)])` — measured, all four of
`['.', a, 'b', null]`, `['.', a, 'b']`, `['.', a, 'b', undefined]` and a hole
validate against it. Whether a chain continuation could be spelled
`option(propertyLambda)` rather than the literal `null` it carries today is a
question about `option` at a declared position — now spellable at the type
level too, since [#1708](https://github.com/functionalscript/functionalscript/pull/1708)
renders such a position optional — and the absence rule answers it the same way
under every option below. It is recorded here only to keep it out: it is not an
argument for either answer.

## The decision

**A. Absence is absence, however spelled.** A trailing `undefined` and a hole
are both absence, so `close([number])` accepts `[1, undefined]`. It is the
answer consistent with everything else RTTI says about absence, and it applies
the same rule
[`./parse-omits-undefined-members.md`](./parse-omits-undefined-members.md)
applies to construction — but that is a shared principle, **not** support: that
issue changes what `parse` builds at a *declared* position, where every answer
here already agrees. `close([number, option(string)])` accepts `[1]` today
(row 3 above), so an omitting `parse`'s output inhabits its closed schema under
B and C as readily as under A. A stands or falls on undeclared positions alone.

**A needs both knobs, not one.** `[1, undefined]` trips both halves of
`extra.length === 0 && fits(...)` independently — it is an undeclared entry
*and* the array is one longer than declared — so the short-circuit says only
which half fires first, not which one to change. Measured: filtering
`undefined`-valued extras out of `undeclaredEntries` while leaving `fits` alone
changes nothing at all in the tuple kind (`[1, undefined]` error, hole error);
patching both gives `[1, undefined]` ok and the hole ok. So **A is C plus the
extra-check change**, and it is the extra check that carries the struct kind
along: `close({ a: number })` against `{ a: 1, b: undefined }` is an error
today with no length check anywhere near it. A costs the only way to reject a
present-but-`undefined` trailing member.

**B. `length` is an attribute of an array value, and `close` is where it
becomes observable.** No *acceptance* changes beyond the `close(c, never)` fix
above, which every answer owes, and `or(close(short), close(long))` stays the
supported way to state a canonical optional tail. What it owes the
reader is narrower than "document the carve-out", because half of it is already
inferable: "Closed containers" in [`../README.md`](../README.md) says a
container whose undeclared members must be the *value* `undefined` states that
rest as a wrapped const, which would be pointless if a bare `close(c)` admitted
one. The **length** half is what no passage reaches — a hole is not an
enumerable entry, so nothing in "the members `c` declares and no others" tells
a reader that `close([number])` also bounds `value.length` and rejects
`[1, ,]`.

**C. A hole is absence; a present-but-`undefined` member is a member.** The
middle: the two tuple `fits` and the data form's `value.length <= pn`, leaving
the extra check — and so the struct kind — untouched. It reads the rule as
being about what a container *holds* rather than how long it is, which is what
`Object.entries` already sees. Under it this file's title is a description of
correct behaviour rather than a complaint.

B is the incumbent and has the better of the argument on the correspondence it
keeps; what it owes is one sentence about `length`, since "Structs and tuples
are open" states the absence rule unconditionally and nothing anywhere says a
closed container also bounds how long a value may be. A
is the most consistent and the most expensive, and it is the only one that has
to answer for the struct kind. C is the smallest, and buys the least: it
removes the hole from the rendered-set correspondence while leaving the
explicit `undefined` outside the absence rule, so it satisfies neither
correspondence fully.

On the evidence here B, documented, is the answer — which makes this issue one
defect to fix, one sentence to write, and two rejected alternatives recorded,
rather than the wholesale behaviour change it looked like from the table alone.
The one thing no answer should do is leave the README stating a rule the
module's own closed containers do not follow.

## Tasks

- [ ] **First, and independent of the decision:** make `close(c, never)` and
      `close(c)` answer alike, by dropping an empty `rest` before the branch in
      `closeContainerValidate` and `closeContainerParse` — not by consulting
      `fits` wherever a `rest` is present, which would reject the values a
      non-empty `rest` exists to admit. `arraySetValidate` needs no change; the
      data form already normalizes the empty `rest` away, which is the half
      that is right. Detect emptiness **semantically**, not as the exported
      `never`: `or()` and `close([never])` are other spellings of the same set,
      and all three accept `[1, ,]` today while their canonical data equals
      `close([number])` and rejects it — so an implementation keying on the
      singleton would pass a `never`-only proof with the disagreement intact.
      Pin it with `[close([number], never), [42, ,]]` **and** one independently
      constructed empty rest in
      [`../validate/proof.f.mjs`](../validate/proof.f.mjs), asserting the
      verdict outright rather than only adding rows: the shared table checks
      that the three readers *agree*, so a row alone passes whenever all three
      move together. Changelog: **BREAKING CHANGES** — `close(c, never)` and
      the other empty-rest spellings stop accepting a trailing hole, which is
      an observable narrowing for callers using the explicit-rest form even
      though it is what the canonical semantics already said. #1712 labelled
      its analogous reader-alignment change the same way.
- [ ] Decide A, B or C.
- [ ] If B, which is what the evidence here favours: say in
      [`../README.md`](../README.md) that a closed container bounds `length`
      too, so a trailing **hole** is a non-member — the one half no passage
      reaches today — and give the reason `arraySetValidate` already gives,
      that this keeps the set equal to what `Ts<>` and JSON Schema render it
      as. Do **not** restate the explicit-`undefined` half: "Closed
      containers" already implies it, by requiring a wrapped-const rest for
      undeclared members that must be `undefined`, and a second telling risks
      contradicting the first.
- [ ] If C: the two tuple `fits`, in
      [`../validate/module.f.mjs`](../validate/module.f.mjs) and
      [`../parse/module.f.mjs`](../parse/module.f.mjs), and the
      `value.length <= pn` half of `arraySetValidate` in
      [`../data/module.f.mjs`](../data/module.f.mjs). Changelog:
      **BREAKING**, `close` accepts a trailing hole.
- [ ] If A: everything C touches, **plus** the `undeclaredEntries` filter in
      `closeContainerValidate` and `closeContainerParse` and the matching
      filter in `arraySetValidate` — patching either knob alone leaves
      `[1, undefined]` rejected. Changelog: **BREAKING**, `close` accepts an
      undeclared `undefined` member.
- [ ] If A, decide the struct kind, which the extra check carries along, and
      note it has a **fourth** site: the data form encodes a closed struct as
      `rest: never` and reads it with `objectSetValidate`, which has no length
      analogue to the tuple kind's, so `{ a: 1, b: undefined }` is rejected
      there by the `rest` alone.
- [ ] Either way, add `[close([number]), [42, undefined]]` to
      [`../validate/proof.f.mjs`](../validate/proof.f.mjs)'s acceptance table.
      The hole row (`[close([number]), [42, ,]]`) is already there; the
      explicit-`undefined` one is what would have shown the two rejections
      apart, and under B it is the row that pins the carve-out. A row is not
      enough on its own — that table only pins that the three readers agree, so
      it passes whenever all three move together. Assert the chosen verdict
      with an `assertOk`/`assertError` oracle beside it, as `optionalPositions`
      does.
- [ ] Either way, say what a consumer wanting exactly one spelling per value
      should use — `or(close, close)` under B, or a normalizer
      ([`./identity-aware-parse.md`](./identity-aware-parse.md)) or a
      schema-external canonicality rule under A and C.
- [ ] Under **A or C**, revisit the "exactly one" sentence in
      [`../../../edag/README.md`](../../../edag/README.md). Both admit a
      hole-padded array as a second spelling of every node, so the claim would
      no longer be literal — A admits a trailing `undefined` on top of that.
      Only B leaves the sentence true as written.

## Related

- [`../README.md`](../README.md) — "Structs and tuples are open" states the
  absence rule; "Closed containers" states `close`.
- [`../validate/module.f.mjs`](../validate/module.f.mjs),
  [`../parse/module.f.mjs`](../parse/module.f.mjs) — `extra.length === 0 &&
  fits(...)`, the two halves this issue is about;
  [`../common/module.f.mjs`](../common/module.f.mjs) — `undeclaredEntries`,
  which walks the *value* with `Object.entries` and so cannot see a hole.
  #1712 moved only the *schema* walk to `Array.from`.
- [PR #1712](https://github.com/functionalscript/functionalscript/pull/1712) —
  the same "a hole is `undefined`" reading, applied to the schema. This is the
  value side, and `close` is where the two readings part.
- [`./parse-omits-undefined-members.md`](./parse-omits-undefined-members.md) —
  the same rule, read by `parse` on the way *out*. Filed with
  [#1708](https://github.com/functionalscript/functionalscript/pull/1708),
  which landed the `Ts<>` half: a trailing omittable position now renders
  optional, so a declared position's rendering tracks its value set.
  **Deliberately not folded into it**, though an earlier draft of this file
  said to: the two ask different questions of different readers, and either can
  be answered without the other. That one is about what `parse` *builds* at a
  **declared** position it found absent; this one is about whether an
  **undeclared** trailing `undefined` or hole is a member at all. Answer A here
  would make them agree at the closed boundary, which is the only place they
  meet.
- [`../../../edag/README.md`](../../../edag/README.md) and
  [`../../../edag/module.f.mjs`](../../../edag/module.f.mjs) — the only
  consumer of `close` outside this directory, its literal uniqueness claim, and
  the `null` terminals that state their continuation rather than omitting it.
