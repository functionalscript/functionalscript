# `close` counts a trailing `undefined` as a present member

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

`close` does not extend the rule past the declared positions. `fits` in
`closeTupleValidate` ([`../validate/module.f.mjs`](../validate/module.f.mjs))
is `value.length <= declared`, `closeTupleParse`
([`../parse/module.f.mjs`](../parse/module.f.mjs)) carries the same one, and
the data form says it as a `rest` of `never` over a prefix the value's length
overruns. So a value carrying nothing past the prefix is still a non-member
when its `length` says otherwise.

Measured at `be345a7`, `validate`, `parse` and the data form agreeing on every
cell:

| schema | `[1]` | `[1, undefined]` | `[1, ,]` (a hole) |
| --- | --- | --- | --- |
| `[number]` | ok | ok | ok |
| `close([number])` | ok | **error** | **error** |
| `close([number, option(string)])` | ok | ok | ok |
| `close([number], () => ['const', undefined])` | ok | ok | ok |

Rows 1 and 3 apply the rule, and row 3 applies it *inside* a closed container,
so this is not "closing is stricter". Row 2 is where absence stops meaning
`undefined`.

**The hole is the sharper half.** `[1, ,]` has no entry at index 1 —
`Object.entries` skips it, so `undeclaredEntries`
([`../common/module.f.mjs`](../common/module.f.mjs)) is empty and there is no
member to hold to a `rest`. It is rejected by `fits` alone, on `length`: the
one attribute the absence rule says stops being observable after the last
required position.

Row 4 is the escape hatch [`../README.md`](../README.md) documents for
undeclared members that must be `undefined`, and it is not the missing
spelling: it states a *different set*, admitting `[1, undefined, undefined]`
and every longer run. There is no way today to say "exactly these members,
where a trailing `undefined` is one of the ways to have none".

## Why it is load-bearing

`or(close(short), close(long))` is the only way to state an optional trailing
operand that rejects a present-but-`undefined` slot. Every `option`-based
spelling accepts one, since that is what `option` means. So a consumer that
wants **one spelling per value** — where a second spelling is a second hash —
gets it today only by relying on the behaviour above.

[`../../../edag`](../../../edag/README.md) is that consumer, and not
hypothetically. Its README states the uniqueness claim as literal:

> "Exactly one" is literal rather than "up to trailing junk", because every
> tuple in the schema is `close`d — `['.', a, 'b', null, 'extra']` does not
> validate.

Against the landed schema, the two neighbouring spellings answer differently
for two different reasons:

| value | `validate(exp)` | why |
| --- | --- | --- |
| `['.', a, 'b', null]` | ok | the canonical spelling |
| `['.', a, 'b', null, 'extra']` | error | an undeclared member, held to an absent `rest` |
| `['.', a, 'b', null, undefined]` | error | **`fits`, on `length` alone** |
| `['.', a, 'b', null, ,]` | error | the same, with no member there at all |

Only the second row is the one the README's sentence describes. The last two
are rejected by the length check, and under the absence rule they are the
canonical value — so whether EDAG's claim is literal depends on an answer this
module has not given. The same question decides the `option` spelling of a
chain continuation: EDAG spells the absent one as a literal `null` today, and
[#1708](https://github.com/functionalscript/functionalscript/pull/1708) removes
what made the alternative unspellable — `Ts<>` now renders a trailing
omittable position optional, so `close([exp, index, option(propertyLambda)])`
would render as it validates. What is then left between `null` and `?` is
exactly this issue.

Either answer serves that consumer as long as it is *stated*. What does not is
the current position, where a canonicality property rests on an unexamined
length check.

## The decision

**A. `close` applies the rule.** A trailing `undefined` — or a hole — is
absence, so `fits` compares against the last present member rather than
`length`, and `close([number])` accepts `[1, undefined]`. This is consistent
with everything else RTTI says about absence, and it is the direction #1708's
construction-side issue pushes: `parse` would stop materializing the member it
just decided was absent, and its output would keep inhabiting a closed schema.
It costs the only way to reject a present-but-`undefined` trailing member, so a
consumer wanting canonical spellings needs a different tool.

**B. `length` is an attribute of an array value, and `close` is where it
becomes observable.** Defensible on its own terms: `close` is the exact-members
statement, and two arrays of different length are different values in
JavaScript whatever their elements hold. Then say so in
[`../README.md`](../README.md) beside the absence rule — which reads as
unconditional today — and keep `or(close(short), close(long))` as the supported
way to state a canonical optional tail.

A fits the model as stated; B is the smaller change and preserves a property
that has a real user. What settles it is whether "the members it declares and
no others" is a claim about *members* or about *length* — and today the module
says the first and does the second.

## Tasks

- [ ] Decide A or B.
- [ ] If A: `fits` in `closeContainerValidate` and `closeContainerParse`, plus
      the closed-tuple conversion in
      [`../data/module.f.mjs`](../data/module.f.mjs), so all three readers move
      together. Add the rows above to
      [`../validate/proof.f.mjs`](../validate/proof.f.mjs)'s acceptance table,
      which carries no closed trailing-`undefined` row today. Changelog:
      **BREAKING**, `close` accepts a trailing `undefined`.
- [ ] If B: state it in [`../README.md`](../README.md) where the absence rule
      is, and pin the table above in the acceptance proof, so the divergence is
      intentional rather than incidental.
- [ ] Either way, say what a consumer wanting exactly one spelling per value
      should use — `or(close, close)` under B, or a normalizer
      ([`./identity-aware-parse.md`](./identity-aware-parse.md)) or a
      schema-external canonicality rule under A.
- [ ] Under A, revisit the "exactly one" sentence in
      [`../../../edag/README.md`](../../../edag/README.md): it would then hold
      up to a trailing `undefined`, which is a weaker claim than the one
      written there.

## Related

- [`../README.md`](../README.md) — "Structs and tuples are open" states the
  absence rule; "Closed containers" states `close`.
- [`../validate/module.f.mjs`](../validate/module.f.mjs),
  [`../parse/module.f.mjs`](../parse/module.f.mjs) — the two `fits`;
  [`../common/module.f.mjs`](../common/module.f.mjs) — `undeclaredEntries`,
  which a hole slips past.
- [PR #1712](https://github.com/functionalscript/functionalscript/pull/1712) —
  the same "a hole is `undefined`" reading, applied to the *schema*. This is
  the value side, and `close` is where the two readings part.
- [PR #1708](https://github.com/functionalscript/functionalscript/pull/1708)
  and its `parse-omits-undefined-members.md` — the rule applied to `Ts<>`'s
  rendering and to `parse`'s output. Fold this file into that one if it lands
  first: same rule, the other reader.
- [`../../../edag/README.md`](../../../edag/README.md) and
  [`../../../edag/module.f.mjs`](../../../edag/module.f.mjs) — the consumer,
  its literal uniqueness claim, and the `null` terminals that state their
  continuation rather than omitting it.
