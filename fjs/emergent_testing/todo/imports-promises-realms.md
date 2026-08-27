## Investigate imports, promises and realms

**Priority:** P3
**Status:** open — investigation, not yet actionable

### Problem

Three mechanisms meet in the runner, none of them is written down as a rule, and
the code where they meet reads as a pile of special cases rather than a design.
They are separate mechanisms that happen to interact, and the interaction is
what nobody has stated:

**A module namespace object is a thenable.** `import()` resolves by *adopting*
what a module exports, so a module exporting a function named `then` corrupts
its own dynamic import. That is why exporting `then` from a proof module is
forbidden ([`spec/todo/3240-export.md`](../../../spec/todo/3240-export.md)) —
but the rule lives in a spec issue and a README paragraph, and nothing checks
it. The proof discovery in `../../dev/module.f.mjs` imports whatever it finds.

**A proof tree is not a thenable, even when it has a `then`.** The runner's rule
is that only an actual `Promise` is an asynchronous value, so `{ then: f }`
returned from a proof is a sub-tree with a test called `then` in it. This is the
opposite reading of the same property name, one layer down, and both readings
are correct in their own layer. Nothing says so in one place.

**`instanceof Promise` is realm-local.** A promise built in an iframe, a worker
or a `node:vm` context is not `instanceof Promise` here, so it is walked as a
proof tree and a *rejected* one is reported as a pass. The deleted browser
runner defended against this with `Symbol.species` shadowing and an intrinsic
`then` — about 150 lines that were, fairly, called a magic mess; they were
removed when the runners were unified, on the grounds that `fjs t` never had
them. The defence is gone and the exposure is not.

The three are usually discussed one at a time, which is why the interaction
keeps being rediscovered: the thing that makes a namespace dangerous (`then` is
adopted) is the thing the runner deliberately refuses to do (`then` is a name),
and the check that separates them (`instanceof`) is the one that does not
survive a realm boundary.

### What to investigate

This is a study, not a design. It is worth doing before
[browser-testing](browser-testing.md) puts proofs in iframes or workers, because
that is the point at which cross-realm promises stop being hypothetical.

- **State the layering.** One document saying which layer adopts a `then` and
  which layer refuses to, and why both are right. Until that exists, every fix
  to one looks like a bug in the other.
- **Find a brand check that survives a realm and cannot be forged.**
  `Object.prototype.toString` is forgeable through `Symbol.toStringTag`.
  `Promise.resolve(p) === p` against the value's own constructor is a candidate.
  Whatever is chosen must be one function every interpreter calls.
- **Decide whether the runner should see namespace objects at all.** If
  discovery handed the runner a plain record of proofs rather than the module
  namespace, the `then` export hazard would not reach it — and the `then`-export
  ban could become a check rather than a convention.
- **Establish what the removed 150 lines actually bought**, from the proofs that
  covered them (`species.proof.mjs` in this PR's history), so that whatever
  replaces them is measured against the same cases rather than against a memory.

### Constraints

- An object carrying a `then` proof property must stay an ordinary proof tree.
- Whatever is added must apply to every runner. A defence in one host only is
  what unifying the runners just finished removing.

### Related

- [Hostile proof values](hostile-proof-values.md) — the cross-realm promise
  exposure, and the traversal guard it shares a cause with.
- [Browser testing](browser-testing.md) — iframes and workers.
- [`spec/todo/3240-export.md`](../../../spec/todo/3240-export.md) — the `then`
  export ban.
