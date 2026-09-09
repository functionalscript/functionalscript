## mapping-precheck. Refuse a mapping over the wrong alphabet at build

**Priority:** P4
**Status:** open

### Problem

A mapping is typed from its rule under the layer's `I` and `O`, so `tsc`
checks that what it reads is what the tree holds — for a mapping written in
TypeScript-checked code. A set assembled at runtime, or one whose mappings
came through a widened type, is checked only where each mapping reads
`meta.id`, in the middle of a parse, as a panic. The `id` convention itself
is not a constraint on `Meta`: nothing in the library reads it yet
([`../../ast/README.md`](../../ast/README.md)).

The tree has no functions in it, and the rule set is finite, so what each
mapping receives is computable per rule name from the mappings' declared
alphabets — which position under the rule is a symbol of which alphabet —
and a mismatch could be refused where the machine refuses everything else,
before any input.

### Proposal

- Each mapping declares the alphabets it emits into and expects, by `id`.
- `parser(rule, set)` computes, over the `RuleSet`, the alphabet at every
  position of every mapped rule's node — an unmapped position is an array,
  a mapped one is its mapping's output `id`, a leaf is the input's — and
  refuses a mapping whose expectation the computation contradicts.
- With a reader in the library, `Meta<M>` constrains `M` to carry `id`.
- Possibly a boundary helper that checks a layer's result is a list of one
  alphabet's symbols, should reading the entry's node by hand prove not to
  be enough; the proof's `tokenSymbols` is what it would replace.

`subset` in [`../../../rtti/data/module.f.mjs`](../../../rtti/data/module.f.mjs)
is the shape of the check.

### Tasks

- [ ] Decide the declaration: an `id` per mapping, or a type carried at
      runtime.
- [ ] The computation and the refusal, with proofs of a mismatch refused.
- [ ] The `id` constraint on `Meta`, and every importer.
- [ ] `tsc`, `fjs test`, 100% coverage.

### Related

- [`../README.md`](../README.md) — "Keyed by identity", where the set is
  refused today.
- [`../../ast/README.md`](../../ast/README.md) — the `id` convention.
