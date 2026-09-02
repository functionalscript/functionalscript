## Rename `checkMap`

**Priority:** P4
**Status:** open

### Problem

`checkMap` in [`../module.f.mjs`](../module.f.mjs) does two things and is named
for one of them. Checking is the part that throws; the part callers actually
want is the return value.

It takes the entries an author declared — `readonly RuleInfo[]`, a sparse list —
walks the rule graph reachable from them, and returns a
`ReadonlyMap<Rule, Base>` covering **every** touched rule, synthesizing an
identity entry (`map: null`, output `ast`) for each one the author did not
declare. So the result is a complete, resolved mapping over the reachable
grammar, not a verdict on the input. A reader who goes by the name expects an
assertion returning nothing much, and a caller cannot tell from the call site
that the sparse declaration has been closed over the rule graph.

The checks it does perform — duplicate rules, kind agreement, declared-vs-
inferred input type, the mapped/unmapped variant boundary — are preconditions of
building that map, not the point of the call.

### Proposal

No design decision here beyond the name; the behavior stays. Candidates, all of
which name the result rather than the guard:

- `resolveMap` — closes a sparse declaration over the reachable rules.
- `compileMap` — declaration in, ready-to-use structure out.
- `completeMap` — names the identity-filling directly.

`buildMap` collides with `build` in the parser's transformer factory
([207 §8](../../../todo/207-bnf-semantic-actions.md)), which is a different
thing, so avoid it.

Whichever wins, say in the JSDoc that the result covers every reachable rule and
that undeclared rules get identity entries — that is the fact the current name
hides.

### Tasks

- [ ] Pick the name.
- [ ] Rename the export, its uses, and the proof group in
      [`../proof.f.mjs`](../proof.f.mjs).
- [ ] State the identity-filling in the JSDoc and in
      [`../README.md`](../README.md), which is currently one heading.
- [ ] Declare the break in the PR description — this is a public API rename.

### Related

- [generic parser metadata](../../../todo/generic-parser-metadata.md) — the
  metadata contract this function stays out of.
- [207 §10](../../../todo/207-bnf-semantic-actions.md) — why this RTTI-checking
  layer is separate from the parser's own transformer map, and keeps its
  `Result`.
- [43. Stateful parser](../../../todo/043-stateful-parser.md) — the parser is
  RTTI-free; a validatable root output is this layer's alone.
