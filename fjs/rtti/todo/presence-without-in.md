## Member presence without `in`

**Priority:** P3
**Status:** open

### Problem

The container readers and validators decide a declared member's presence with
`k in value`: four sites in [`common`](../common/module.f.mjs)
(`consPresent` and the container handlers) and one in
[`data`](../data/module.f.mjs) (the container validator). The compiler refuses
`in` by design ([2346](../../../spec/todo/2346-in-operator.md)), so both
modules stop there once their other refusals are gone.

`hasEntry` is not a drop-in replacement here. The presence test is
HasProperty on purpose: `common` documents that "`getItem` reads through the
prototype, so a member the prototype supplies is still held to what the
schema says a present value is", and `getItem` is `value[k]`. A struct schema
declaring an optional `toString` member answers differently for `{}`: under
`in` the inherited function is present and fails the member's schema; under
`hasEntry` it is absent and legal.

### Proposal

Decide presence and the read together, as own enumerable entries: `hasEntry`
for presence and `entry` for `getItem`, so that a member a prototype supplies
is absent rather than read. This is the data model the language already has
(it has no prototype chain), and FunctionalScript cannot build a value whose
prototype holds a declared member other than a built-in name. It is a
behavior change for such names and for values built in plain JavaScript, so it
needs its own pull request with proofs pinning the new answers, and the
`common` comments rewritten to match.
