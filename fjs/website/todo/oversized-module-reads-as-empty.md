## A module over 128 KiB is read as importing nothing

**Priority:** P2
**Status:** open

### Problem

[`../module.f.mjs`](../module.f.mjs)'s `readModule` swallows every failed read,
because the failure it expects is benign: the scan is textual, so a module that
emits source of its own offers up import lines that were never its own, and a
relative specifier naming no file is the ordinary result. The deleted
`browser-prepare.mjs` swallowed reads for the same reason.

One failure is not benign. `ReadFile` caps a file at **131,072 bytes** — a
limit `fjs/effects/node/types.ts` states, chosen for Bun's `bigint` size
constraint — and `fs.readFile` in the deleted script had no cap. So a reachable
`.f.mjs` over 128 KiB now reads as a module with no imports, and:

- its own blockers are invisible, so a proof module that imports it is selected;
- the page then fails **while linking**, before the runner can publish a
  report, which is the outcome the whole selection exists to prevent.

The input that breaks it is one authored file over 128 KiB anywhere in the
reachable graph. Nothing in the repository is close today — the largest
authored `.f.mjs` is far under it — which is why this is recorded rather than
guarded.

### Why the obvious guard is not written

Refusing a non-`ENOENT` read (`isNotFound` is right there) is three lines, and
it cannot be proven: **the virtual interpreter answers every failed read with
`ENOENT`**, whatever the reason, so the refusing branch is unreachable under
`npm run cov`'s 100% branch threshold. An unprovable guard in a module the gate
covers is not an option, and neither is a guard nobody can see fail.

### Proposal

Fix the interpreter first, then the guard:

1. give `fjs/effects/node/virtual` the same 128 KiB cap the real one has, so a
   fixture can produce the failure at all — the two interpreters disagreeing
   about a documented limit is a defect on its own;
2. then have `readModule` refuse a read failure that is not a missing path,
   and pin it with a fixture holding an oversized file.

An alternative that needs no interpreter change: `stat` each module first and
treat "too large to read" as a *blocker*, so the module is dropped with a
printed reason rather than silently selected. That costs one operation per
module and makes the failure visible in the same place every other unlinkable
module appears.

### Tasks

- [ ] Enforce `ReadFile`'s size cap in the virtual interpreter, with a proof.
- [ ] Refuse a non-missing read failure in `website/module.f.mjs`, with a proof
      built on that fixture.

### Related

- [`fjs/effects/node/types.ts`](../../effects/node/types.ts) — where the cap is
  declared.
