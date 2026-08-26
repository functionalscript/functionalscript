# `close` splits one value into a member and a non-member

**Priority:** P3 — nothing is broken today; what is missing is the decision,
which a consumer already depends on without either module saying so
**Status:** open — a decision about what `close` states, not a patch to one
reader

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
readers agree cell for cell.

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
question about `option` at a declared position, which the absence rule already
answers the same way under every option below. It is recorded here only to
keep it out: it is not an argument for either answer.

## The decision

**A. Absence is absence, however spelled.** A trailing `undefined` and a hole
are both absence, so `close([number])` accepts `[1, undefined]`. Consistent
with everything else RTTI says, and the direction the construction-side issue
on the open [#1708](https://github.com/functionalscript/functionalscript/pull/1708)
would push: `parse` would stop materializing the member it decided was absent,
and its output would keep inhabiting a closed schema. The knob is the
`undeclaredEntries` filter, **not** `fits` — and that filter is shared with the
struct kind, so A also has to answer `close({ a: number })` against
`{ a: 1, b: undefined }`, an error today with no `fits` involved. It costs the
only way to reject a present-but-`undefined` trailing member.

**B. `length` is an attribute of an array value, and `close` is where it
becomes observable.** Nothing changes. Then say so in
[`../README.md`](../README.md) beside the absence rule, which reads as
unconditional today, and keep `or(close(short), close(long))` as the supported
way to state a canonical optional tail.

**C. A hole is absence; a present-but-`undefined` member is a member.** The
middle: the two tuple `fits` and the data form's `value.length <= pn`, leaving
the extra check — and so the struct kind — untouched. It reads the rule as
being about what a container *holds* rather than how long it is, which is what
`Object.entries` already sees. Under it this file's title is a description of
correct behaviour rather than a complaint.

B is the incumbent and has the better of the argument on the correspondence it
keeps; what it owes is a sentence, since the README states the absence rule
unconditionally and a reader has no way to learn that `close` is carved out. A
is the most consistent and the most expensive, and it is the only one that has
to answer for the struct kind. C is the smallest, and buys the least: it
removes the hole from the rendered-set correspondence while leaving the
explicit `undefined` outside the absence rule, so it satisfies neither
correspondence fully.

On the evidence here B, documented, is the answer — which makes this issue a
documentation fix with two rejected alternatives recorded, rather than the
behaviour change it looked like from the table alone. The one thing no answer
should do is leave the README stating a rule the module's own closed containers
do not follow.

## Tasks

- [ ] Decide A, B or C.
- [ ] If B, which is what the evidence here favours: state the carve-out in
      [`../README.md`](../README.md) where the absence rule is — the rule holds
      of every declared position and of the open forms, and stops at a closed
      container's undeclared ones — and give the reason `arraySetValidate`
      already gives, that this keeps the set equal to what `Ts<>` and JSON
      Schema render it as.
- [ ] If A: the `undeclaredEntries` filter in `closeContainerValidate` and
      `closeContainerParse`, plus `arraySetValidate` in
      [`../data/module.f.mjs`](../data/module.f.mjs), so all three readers move
      together — and decide the struct kind, which shares that filter.
      Changelog: **BREAKING**, `close` accepts an undeclared `undefined`
      member.
- [ ] If C: the two tuple `fits`, in
      [`../validate/module.f.mjs`](../validate/module.f.mjs) and
      [`../parse/module.f.mjs`](../parse/module.f.mjs), and the
      `value.length <= pn` half of `arraySetValidate`. Changelog:
      **BREAKING**, `close` accepts a trailing hole.
- [ ] Either way, add `[close([number]), [42, undefined]]` to
      [`../validate/proof.f.mjs`](../validate/proof.f.mjs)'s acceptance table.
      The hole row (`[close([number]), [42, ,]]`) is already there; the
      explicit-`undefined` one is what would have shown the two rejections
      apart, and under B it is the row that pins the carve-out.
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
- [PR #1708](https://github.com/functionalscript/functionalscript/pull/1708),
  open — its `parse-omits-undefined-members.md` applies the rule to `parse`'s
  output, and it would render a trailing omittable position optional in `Ts`.
  Fold this file into that one if it lands first: same rule, the other reader.
- [`../../../edag/README.md`](../../../edag/README.md) and
  [`../../../edag/module.f.mjs`](../../../edag/module.f.mjs) — the only
  consumer of `close` outside this directory, its literal uniqueness claim, and
  the `null` terminals that state their continuation rather than omitting it.
