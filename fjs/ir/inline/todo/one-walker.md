## One walker for the inline pass

**Priority:** P3
**Status:** open

### Problem

[`module.f.js`](../module.f.js) holds two passes, `inline` over the plain
stage and `inlineHooks` over the checked module, and each has its own
walker: `write` and `expand`. The two are the same switch over every term
kind, case for case and comment for comment — the same order of children,
the same `rename` at each binder, the same `within` at a `block` and a
`loop`, the same "a repeat names the loop's parameters" at a `br`. Around
them `each` and `eachTyped` are one reducer written twice, `copy` and
`copyTyped` both open with `fresh` and close a body over its parameters,
and [`private.ts`](../private.ts) carries the pair as types: `_Names` and
`_TypedNames`, `_Write` and `_Expand`, `_Pass` and `_Hooks`.

What differs is what a node is written as, and nothing about the walk:

```js
// write, which answers a Term
case 'field': {
    const [e, n1] = one(t[1], n)
    return [['field', e, t[2]], n1]
}
// expand, which answers a Typed
case 'field': {
    const [e, n1] = one(t[1], n)
    return [[type, ['field', e, t[2]]], n1]
}
```

`write` drops each type as it goes, and keeps the two places where the
plain form needs one: the target of a `trunc_sat` or a `seal`, and an
arm's `written` variants in place of the checked ones. `expand` keeps
every type. That is the erasure of a typed term, done inside a walker
whose subject is names and copies.

The rules that are the pass's own exist once per walker as a result, and
they are the ones that are easy to get wrong: which labels name loops,
what a `br` to one renames, the order in which the prefix counter passes
through the children. A correction to one is a correction to both, and
only the proof of the walker that was corrected fails without it. A new
term kind is a case in each, beside the switches that
[a term's children, stated once](../../todo/term-children-once.md) lists.

### Proposal

Separate the two concerns that `write` joins.

- **`plain: (t: Typed) => Term`** in [`fjs/ir`](../../module.f.js), beside
  `terms` and `inside`: the plain stage's form of a typed term. It is a
  fact about the two representations, not about inlining, and the place
  where "an `op` keeps its target only for `trunc_sat` and `seal`" and
  "an arm is written with its `written` variants" are stated.
- **One walker, typed in and typed out**: `expand`. `inline` is then
  `plain` of what it answers, and `write`, `each`, `_Names`, `_Write` and
  `_Written` go.
- **One `copy`**, which differs between the passes in a policy and not in
  shape: the plain pass lends a made value in place, widens a narrower
  argument with a `block`, and wraps the body only where `blocked` says
  so; the hook pass binds every argument and always wraps. The policy is
  an argument: which parameters read in place, and whether the copy is
  wrapped.

The pass should come out near half its size, with every naming rule
written once.

### Drawbacks

- A copy that the plain pass writes typed carries types that nothing
  checked: the widening `block` and the `let` of an argument are typed
  from the parameter, by the pass. They are erased before anyone reads
  them, since the lifetime pass and the checker run on the plain result,
  but a typed term that is not a checked one is a new thing to have in
  hand, and its type should say so, or `plain` should be the only reader.
- An argument passed in place is a `Term` today, as the pass wrote it;
  in a typed walker it is the caller's `Typed`, whose type is the
  parameter's by the `equal` test that admits it. The comparison rule,
  "only a local that a comparison reads narrows", reads the written
  argument and has to keep doing so.
- `plain` and the walker each visit the term, where `write` visits it
  once. The repository's first principle answers that.

### Tasks

- [ ] `plain` in `fjs/ir`, with its proof: `plain` of a checked body is
      what `checkPlain` accepted.
- [ ] `inline` through `expand` and `plain`; `write` and its types go.
- [ ] One `copy` over a policy; `copyTyped` goes.

### Related

- [A term's children, stated once](../../todo/term-children-once.md):
  `withTerms` would shorten the one walker that remains, and its
  `binders` is this module's `bound`.
- [The facts the IR's stages share](../../todo/shared-stage-facts.md):
  `linear` in `inline` looks a sealed type's definition up as `defIn`
  does.
- [Inline decisions from a profile](../../todo/inline-decisions.md):
  feeds `inlined`, which both passes read and which stays as it is.
