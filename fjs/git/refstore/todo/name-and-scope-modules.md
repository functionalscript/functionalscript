## name-and-scope-modules. `refstore` is a name codec, a scope policy and a walk in one file

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) is the largest module under `fjs/` and
holds three jobs that never touch each other's state:

- **The byte-name ↔ host-path codec**: `nameBytes`, `nameText`, `nameKey`,
  `nameForMessage`, `askable`, `isUnderRefs`, `headName` and
  the module-scope `toBytes`/`toVec`. None runs an effect; together they
  are the rule the module doc spends four paragraphs on ("a ref name is
  bytes and a path is text, joined by UTF-8 in both directions").
- **Which directory owns a name**: `isPseudoref`, `perWorktreePrefixes`,
  `isPerWorktree`, `isShared`, `holdsPerWorktreeOnly`, `mayHoldPerWorktree`,
  `sharedScope`, `worktreeScope`, `dirOf`, with `_Scope` in `private.ts`.
  Also pure, with its own nine-row pseudoref table.
- **The effectful walk**: `tryBytes`, `tryPackedRefs`, `headBytes`,
  `lookupOf`, `tryResolve`, `descendInto`, `readAsRef`, `statted`,
  `ownRefs`, `tryHeadFound`, `combine`, `tryRoots` and the rest.

The codec is consulted from the walk with the same two-step dance in
several places — `askable`, `nameForMessage` and `targetAllowed` each
`byteArray` a name and then ask `nameText` or `isWholeName` of it — which
is what a module boundary would name once.

[byte-ref-names.md](./byte-ref-names.md) will rewrite the codec end to
end; today that rewrite happens inside a file whose other thirteen
hundred lines are effects. The scope predicates need a filesystem fixture
to reach in the proof, where a direct proof over `isShared` and
`mayHoldPerWorktree` needs none.

### Proposal

Two private siblings: `fjs/git/refstore/name/module.f.mjs` for the codec
and `fjs/git/refstore/scope/module.f.mjs` for the scope policy, `_Scope`
moving with it. `module.f.mjs` keeps the walk. No behaviour changes; the
existing proof splits along the same lines, and the "answer one name
differently on purpose" property of `tryRoots` against `tryResolve` becomes
a statement about one small module's two callers rather than about the
whole store.

### Tasks

- [ ] `name/` and `scope/` with their proofs at 100%; `module.f.mjs`
      imports them.
- [ ] `tsc`, `fjs test`; the store's proof passes unchanged.

### Related

- [byte-ref-names.md](./byte-ref-names.md) — the codec's rewrite, easier
  against a module of its own.
- [`fjs/git/refname`](../../refname/module.f.mjs)'s `sameBytes` — the
  comparison of two names, already shared rather than part of the codec.
