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
flips to `ok`. The data form says the same in the same two halves,
`extra.length === 0 && value.length <= pn` in `arraySetValidate`
([`../data/module.f.mjs`](../data/module.f.mjs)), which is why all three
readers agree cell for cell on every schema above.

So exactly one case rests on `length`, the attribute the absence rule says
stops being observable after the last required position. The other rests on
counting a present-but-`undefined` member as a member — defensible, but the
same question one step in, since the rule says that member *is* absence.

### A defect falls out, and it has to be fixed whichever answer wins

Both length checks sit in the **no-`rest`** branch. Supplying a `rest` skips
them, and a hole is no entry, so it meets nothing on the way through — while
the data form, reading a normalized set rather than a spelling, still applies
its own. `never` is a public spelling of the exact-members set, and `close(c)`
and `close(c, never)` normalize to the identical `Data`, so the two must be one
schema. They are not:

| schema | `[1]` | `[1, undefined]` | `[1, ,]` (a hole) |
| --- | --- | --- | --- |
| `close([number])` | ok / ok / ok | error / error / error | error / error / error |
| `close([number], never)` | ok / ok / ok | error / error / error | **ok / ok / error** |

(`validate` / `parse` / data form; `cmp` reports the two `toData` results
equal.) That is a reader disagreement of exactly the kind #1712 fixed, not a
design choice: whichever of A, B or C is chosen, one spelling of a set cannot
accept what another rejects. It is listed first in the tasks for that reason,
and it means **B is not documentation-only**.

The fix is to **normalize an empty `rest` to no `rest`** — what `toData`
already does, and why the two disagree in the first place:

```
toData(close([number]))         {"array":[{"prefix":[{"number":true}]}]}
toData(close([number], never))  {"array":[{"prefix":[{"number":true}]}]}   ← no rest
```

Not to consult `fits` wherever a `rest` is present: `fits` is
`value.length <= declared`, so that would reject the values a `rest` exists to
admit — `close([number], string)` would stop accepting `[1, 'x']`, which all
three readers take today.

### The length half has a stated defence

It is not an oversight, and the argument is already written down, in
`arraySetValidate`:

> a hole past it is not an entry, but the array is still that long, and this is
> the set `Ts<>` renders as a tuple of exactly `pn` positions and JSON Schema
> as `items: false`

`Ts<close([number])>` is `readonly[number]`, which no length-2 array inhabits
however its second element is spelled, and `items: false` says the same to a
JSON Schema consumer. Drop the length check and the closed tuple's value set
stops matching both of its own renderings.

So the decision is not "fix an inconsistency" but a choice between two
correspondences the module currently cannot both keep: **absence is
`undefined`** (the README's rule, which the length check breaks) and **the set
is what it renders as** (which dropping it breaks).

## Who depends on the answer

`or(close(short), close(long))` is the only way to state an optional trailing
operand that rejects a present-but-`undefined` slot, and it rejects it through
the extra check: position 3 is undeclared in the short alternative, and not a
`propertyLambda` in the long one. So a consumer that wants **one spelling per
value** — where a second spelling is a second hash — depends on the answer.

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

**Out of scope: a declared `option` position.** Measured, all four of
`['.', a, 'b', null]`, `['.', a, 'b']`, `['.', a, 'b', undefined]` and a hole
validate against `close(['.', exp, index, option(propertyLambda)])`, under
every answer below — row 3 above is the same fact. Whether a chain
continuation could be spelled that way is a separate question, noted only to
keep it out.

## The decision

**A. Absence is absence, however spelled.** A trailing `undefined` and a hole
are both absence, so `close([number])` accepts `[1, undefined]` — the answer
consistent with everything else RTTI says. It needs **both** knobs, not one:
`[1, undefined]` trips both halves independently, so filtering
`undefined`-valued extras while leaving `fits` alone changes nothing in the
tuple kind (measured), and patching both is what admits it. **A is therefore C
plus the extra-check change**, and the extra check carries the struct kind
along — `close({ a: number })` against `{ a: 1, b: undefined }` is an error
today with no length check anywhere near it. A costs the only way to reject a
present-but-`undefined` trailing member, and it reaches past the readers into
the canonical form: `close([number])` and
`close([number], () => ['const', undefined])` would then accept the same
arrays, while `toData` still gives the first no `rest` and the second
`rest: { unit: 2 }`, so `cmp` and `equal` would report two canonical sets for
one membership. A therefore owes the data algebra a change too, not just the
validators. It shares its principle with
[`./parse-omits-undefined-members.md`](./parse-omits-undefined-members.md), but
draws no support from it: that issue changes a *declared* position, where every
answer here already agrees, so A stands or falls on undeclared ones alone.

**B. `length` is an attribute of an array value, and `close` is where it
becomes observable.** No acceptance changes beyond the `close(c, never)` fix
every answer owes, and `or(close(short), close(long))` stays the supported way
to state a canonical optional tail. What it owes the reader is one sentence
about `length`: the explicit-`undefined` half is already inferable, since
"Closed containers" requires a wrapped-const rest for undeclared members that
must be `undefined`, which would be pointless if a bare `close(c)` admitted
one. Nothing anywhere reaches the length half — a hole is not an enumerable
entry, so "the members `c` declares and no others" never tells a reader that
`close([number])` also bounds `value.length`.

**C. A hole is absence; a present-but-`undefined` member is a member.** The
middle: the two tuple `fits` and the data form's `value.length <= pn`, leaving
the extra check — and so the struct kind — untouched. It reads the rule as
being about what a container *holds* rather than how long it is, which is what
`Object.entries` already sees.

B is the incumbent and has the better of the argument on the correspondence it
keeps, and owes only that sentence. A is the most consistent and the most
expensive, and the only one that has to answer for the struct kind. C is the
smallest and buys the least: it removes the hole from the rendered-set
correspondence while leaving the explicit `undefined` outside the absence rule,
satisfying neither fully. On this evidence B, documented, is the answer —
making this issue one defect to fix, one sentence to write, and two rejected
alternatives recorded. What no answer should do is leave the README stating a
rule the module's own closed containers do not follow.

## Tasks

- [ ] **First, and independent of the decision:** make `close(c, never)` and
      `close(c)` answer alike, by dropping an empty `rest` before the branch in
      `closeContainerValidate` and `closeContainerParse`. `arraySetValidate`
      needs no change — the data form already normalizes it away, which is the
      half that is right.
- [ ] Define "empty" as **making no difference to the canonical form**: drop
      the `rest` exactly when `toData(close(c, rest))` equals
      `toData(close(c))`. An equality, not an observation about whether the
      result carries a `rest` key, and not a judgement about the `rest` itself
      — four **cases** fix the criterion between them, and only the equality
      satisfies all four (the first groups three spellings that behave alike):
      - `never`, `or()` and `close([never])` all make the conversion equal to
        `close(c)`'s, so all three must be dropped. Keying on the exported
        `never` alone would pass a `never`-only proof with the disagreement
        intact.
      - `const r = () => ['close', [r], undefined]` has no finite inhabitant,
        but `toData(close([number], r))` keeps `rest: "r"` and all three
        readers accept `[1, ,]`. A reader that "recognised" that emptiness
        would start rejecting what the data form accepts.
      - `const a = () => ['or', b]; const b = () => ['or', a]` rules out the
        `rest`'s own canonical data as the test: `toData(a)` **is** `never`,
        yet `toData(close([number], a))` still carries `rest: "a"` and all
        three accept `[1, ,]`.
      - `unknown` rules out "the conversion kept no `rest`" as the test.
        `toData(close([], unknown))` is `{ array: true }` — the whole array
        kind, with no `rest` key, because a top `rest` collapses the pattern
        rather than being dropped from it. All three readers accept `[1]`,
        while `close([])` rejects it, and `toData(close([]))` is
        `{ array: [{ prefix: [] }] }`, so the equality separates them where
        the absence of a key does not.
- [ ] Pin those cases as **six rows** — the first case needs one per spelling,
      since the three are not interchangeable: an implementation that
      recognises empty unions but not `close([never])` passes a row using
      `or()` while keeping that spelling's disagreement, and one keyed on
      identity passes the converse. Name all three rather than "an
      independently constructed empty rest". In
      [`../validate/proof.f.mjs`](../validate/proof.f.mjs), asserting the
      verdict outright: the shared table checks only that the three readers
      *agree*, so a row alone passes whenever all three move together. Dropped,
      on `[42, ,]`: `close([number], never)`, `close([number], or())` and
      `close([number], close([never]))`. Kept: `r` and the `a`/`b`
      cycle on `[42, ,]`, and `[close([], unknown), [1]]`. None is redundant — `a`/`b` catches a test
      on the `rest`'s own canonical data, `r` catches an emptiness analysis
      reaching `close` cycles but not `or` cycles, and `unknown` catches a test
      that reads the absence of a `rest` key as elimination.
      Changelog entry prefixed `**BREAKING CHANGES:**` — the empty-rest
      spellings stop accepting a trailing hole, an observable narrowing for
      callers using the explicit-rest form. #1712 labelled its analogous
      reader-alignment change the same way.
- [ ] Decide A, B or C.
- [ ] If B, which the evidence favours: say in [`../README.md`](../README.md)
      that a closed container bounds `length` too, so a trailing **hole** is a
      non-member, giving the reason `arraySetValidate` already gives — it keeps
      the set equal to what `Ts<>` and JSON Schema render it as. Do **not**
      restate the explicit-`undefined` half; "Closed containers" already
      implies it, and a second telling risks contradicting the first.
- [ ] If C: the two tuple `fits`, in
      [`../validate/module.f.mjs`](../validate/module.f.mjs) and
      [`../parse/module.f.mjs`](../parse/module.f.mjs), and the
      `value.length <= pn` half of `arraySetValidate`. Changelog entry prefixed
      `**BREAKING CHANGES:**` — `close` accepts a trailing hole.
- [ ] If A, **decide the struct kind before writing any of it**, because the
      code cannot leave it open: `undeclaredEntries` is called once in the body
      of `closeContainerValidate` and `closeContainerParse`, which both kinds
      instantiate, so filtering it there makes `close({ a: number })` accept
      `{ a: 1, b: undefined }` whether or not that was decided. The struct kind
      also has a **fourth** site — the data form encodes a closed struct as
      `rest: never` and reads it with `objectSetValidate`, which has no length
      analogue, so `{ a: 1, b: undefined }` is rejected there by the `rest`
      alone.
- [ ] If A **and the struct kind is out**: scope the filter to the tuple kind
      by passing it in per-kind, as `fits`, `getItem` and `schemaEntries`
      already are, rather than filtering in the shared body.
- [ ] If A **and the struct kind is in**: `objectSetValidate` changes too, or
      the data form keeps rejecting what `validate` and `parse` now accept —
      measured, an extra-check-only patch flips the struct case in those two
      and leaves the data form at `error`. Add a struct oracle beside the
      tuple ones.
- [ ] If A: everything C touches, **plus** that filter and the matching one in
      `arraySetValidate`. Changelog entry prefixed `**BREAKING CHANGES:**` —
      `close` accepts an undeclared `undefined` member.
- [ ] If A, the canonicalization too, not only the readers — and as an
      invariant rather than a list of spellings. **Under A, "admits only
      `undefined`" stops distinguishing a member from its absence, so every
      place the canonical form can record such a member has to collapse.**
      Measured today, six spellings that A would make equal in membership and
      leave distinct in data:

      | schema | `toData` |
      | --- | --- |
      | `close([number])` | `{prefix:[{number:true}]}` |
      | `close([number], cu)` | `{prefix:[{number:true}], rest:{unit:2}}` |
      | `close([number, cu])` | `{prefix:[{number:true},{unit:2}]}` |
      | `close({a:number})` | `{props:{a:…}, rest:{}}` |
      | `close({a:number}, cu)` | `{props:{a:…}, rest:{unit:2}}` |
      | `close({a:number, b:cu})` | `{props:{a:…,b:{unit:2}}, rest:{}}` |

      (`cu` is `() => ['const', undefined]`.) So it is not one rule about an
      array `rest`: a trailing `{unit:2}` prefix node, an object `rest` and an
      undefined-only property each need the same treatment. Audit for the
      general case rather than these six, since the list is not claimed
      exhaustive, and pin the equalities.

      **Collapse exactly what the readers stopped distinguishing, per kind.**
      The invariant follows the decision above, it does not outrun it: with the
      struct kind **out**, the readers still reject `{ a: 1, b: undefined }`
      against `close({ a: number })`, so collapsing the object rows would give
      one canonical form — and one `../../../cas` hash — to two different
      memberships, which is the same defect this issue opens with, pointed the
      other way. The array rows go with A; rows four to six go with struct-in
      and not otherwise.
- [ ] Either way, add `[close([number]), [42, undefined]]` to
      [`../validate/proof.f.mjs`](../validate/proof.f.mjs)'s acceptance table,
      with an `assertOk`/`assertError` oracle beside it as `optionalPositions`
      has. The hole row is already there; the explicit-`undefined` one is what
      would have shown the two rejections apart, and under B it pins the
      carve-out.
- [ ] Either way, say what a consumer wanting exactly one spelling per value
      should use — `or(close, close)` under B, or a normalizer
      ([`./identity-aware-parse.md`](./identity-aware-parse.md)) or a
      schema-external canonicality rule under A and C.
- [ ] Under **A or C**, revisit the "exactly one" sentence in
      [`../../../edag/README.md`](../../../edag/README.md). Both admit a
      hole-padded array as a second spelling of every node, so the claim would
      no longer be literal — A admits a trailing `undefined` on top of that.
      Only B leaves it true as written.

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
  the same rule, read by `parse` on the way *out*, filed with
  [#1708](https://github.com/functionalscript/functionalscript/pull/1708).
  **Not folded into it:** that one asks what `parse` *builds* at a **declared**
  position it found absent, this one whether an **undeclared** trailing
  `undefined` or hole is a member at all, and either can be answered without
  the other. Answer A would make them agree at the closed boundary, the only
  place they meet.
- [`../../../edag/README.md`](../../../edag/README.md) and
  [`../../../edag/module.f.mjs`](../../../edag/module.f.mjs) — the only
  consumer of `close` outside this directory, its literal uniqueness claim, and
  the `null` terminals that state their continuation rather than omitting it.
