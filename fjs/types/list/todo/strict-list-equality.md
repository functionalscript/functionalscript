## Strict element-wise equality has one home

**Priority:** P5
**Status:** open

### Problem

"Two lists hold the same items, compared with `===`" is
[`../module.f.mjs`](../module.f.mjs)'s `equal` over `strictEqual`, and it has
no name of its own there. Its consumers bind it under names of theirs, and
two of them export it:

- [`fjs/git/refname`](../../../git/refname/module.f.mjs) exports it as
  `sameBytes`, which `fjs/git/header`, `fjs/git/walk` and `fjs/git/refstore`
  import from that module;
- [`fjs/sul/level/literal`](../../../sul/level/literal/module.f.mjs) exports
  it as `wordEqual`;
- [`fjs/fsm`](../../../fsm/module.f.mjs) binds it inside `mergeOp`.

Two more places spell it out by hand over arrays instead:
[`fjs/fsc/parser`](../../../fsc/parser/module.f.mjs)'s `sameRef`, and the
`same` helper in `fjs/git/packstore/proof.f.mjs`, both
`a.length === b.length && a.every(…)`.

`sameBytes` carries meaning of its own — its JSDoc is where Git's byte-exact
comparison of names is written down — so the problem is not the domain name.
It is that a general comparison lives in a ref-name module, where a header
reader has to go for it, and that nothing points a new consumer at one
definition instead of another.

### Proposal

Export the strict form from `types/list` under a name of its own. The domain
modules then name it for their domain in terms of it, or import it directly,
and `sameRef` and the proof's `same` use it. Which of `sameBytes` and
`wordEqual` stay as named aliases is the module owners' call; a removed export
is a breaking change to declare.

### Tasks

- [ ] Export the strict element-wise equality from `fjs/types/list`, with a
      proof.
- [ ] `fjs/fsc/parser`'s `sameRef` and `fjs/git/packstore`'s proof `same`
      through it; `fjs/fsm` and the two exports in terms of it.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`fjs/types/function/operator`](../../function/operator/module.f.mjs) —
  `strictEqual`.
