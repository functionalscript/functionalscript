## retired-issue-identifiers. Resolve the remaining bare `iNNN` citations

**Priority:** P4
**Status:** open

### Problem

Citations to the retired tracker survive across the tree as bare identifiers —
`i163`, `i183`, `i662` and so on. [#1692](https://github.com/functionalscript/functionalscript/pull/1692)
resolved the ones it had claimed were untraceable and documented the search that
finds them ([`todo/README.md`](./README.md), "Retired `iNNN` identifiers"), but
stopped there rather than widening further. This issue is the remainder.

The claim that a bare identifier has "no file left to point at" was wrong. The
retired tracker was a top-level `issues/` directory of `issues/NNN-{slug}.md`
files, and deleting them removed them from the working tree, not from history.
Every cited identifier below has a file:

|Identifier|Retired file|Status when deleted|Cited in|
|-|-|-|-|
|`i149`|`issues/149-sandbox.md`|—|`fjs/emergent_testing/todo/206.md`|
|`i155`|`issues/155-test-runner-integration.md`|—|`emergent_testing/todo/211.md`, `661-test-runner-behavior.md`|
|`i163`|`issues/163-reporter-test-method.md`|open|`fjs/emergent_testing/todo/211.md`|
|`i183`|`issues/183-tf-framework-scenario-tests.md`|open|`emergent_testing/todo/206.md`, `65y-proof-asserteq-adoption.md`|
|`i189`|`issues/189-asn1-decode-all-unfold.md`|done|`fjs/asn.1/todo/65z-asn1-tag-codec-table.md`|
|`i180-sorted-set-intersect-symmetry`|`issues/180-…`|done|`fjs/types/todo/66b-sorted-list-cmp-reduce-factory.md`|
|`i662`|`issues/662-rtti-ts-printer-visit.md`|open|`fjs/types/todo/66d-ts-printer-tuple-readonly-fold.md`|
|`i665-mcp`|`issues/665-mcp.md`|open|`fjs/protocol/json_rpc/todo/effectful-dispatch-skeleton.md`|
|`i666-utf8-continuation-helpers`|`issues/666-…`|done|`fjs/text/todo/666-utf16-encode-errormask.md`|
|`i65X-sandbox-async`|`issues/65X-sandbox-async.md`|done|`emergent_testing/todo/65y-proof-asserteq-adoption.md`|
|`i65Y-sandbox-await-overhead`|`issues/65Y-sandbox-await-overhead.md`|done|`emergent_testing/todo/661-sandbox-isolated-test-execution.md`|
|`i65Y-proof-by-export`|`issues/65Y-proof-by-export.md`|open|`emergent_testing/todo/65y-proof-asserteq-adoption.md`|

Finding the file is mechanical. Deciding what the citation should say instead is
not, and both outcomes occur:

- **It migrated.** `i665-mcp` is `fjs/protocol/mcp/todo/README.md`'s `## 665-mcp`
  section, which that file already links to by anchor — only the citations in
  *other* files are stale.
- **It may not have.** `i65Y-proof-by-export` was open when it was deleted and no
  file on disk carries its content. Either it was dropped deliberately and the
  citation should go, or it was lost in the migration and should be restored
  from history. That is a maintainer's call, not a mechanical edit — which is
  the reason this is filed rather than fixed.

`Status when deleted` is left blank above where the retired file predates the
`**Status:**` header convention.

### The same problem, without the numbers

`iNNN` is not the only naming scheme this hits. Todo files under their current
`{slug-kebab}.md` names are deleted when their issue is fixed, as the README
requires, and a citation to one is left just as bare — `nullable-analysis-shared`
in [`fjs/bnf/todo/rule-visitor.md`](../fjs/bnf/todo/rule-visitor.md) was one
until this branch resolved it (shipped as `emptyTagMap` in `fjs/bnf/data`,
commit `94b7ff06`, which deleted the file in the same change). The same search
finds these, against the todo path rather than `issues/`:

```sh
git log --all --format='%h %s' --diff-filter=D -- '*nullable-analysis-shared*'
```

That commit's message names both what shipped and the deletion, which is the
whole answer. This issue does not enumerate that class, and there is no reason
to think `rule-visitor.md` is the only instance.

### Proposal

For each row: read the retired file (the README's search 1), decide which of the
three outcomes applies — open under a new slug, shipped as code, or won't fix —
and rewrite every citation to name it. Where nothing survives, either restore
the file under `{slug-kebab}.md` or delete the reference; do not leave a bare
identifier behind, since the next reader has no way to tell "unresolved" from
"unresolvable".

### Tasks

- [ ] Resolve the twelve identifiers above against their retired files.
- [ ] Decide `i65Y-proof-by-export`: restore it or drop its citation.
- [ ] Sweep for slug-named deletions the same way, per the section above.
- [ ] Re-run the sweep afterwards; the only `i…` tokens left should be integer
      type names.

### Caveat for whoever sweeps this

`\bi\d+\b` matches Rust and Wasm integer type names, and the collision is not
theoretical — an earlier revision of this issue listed one of them as a citation
to repair. Three occur today, none of them citations:

- `i32` in `fjs/text/README.md:44-45,76-77` — `List<i32>` in four codec
  signatures. There is a retired `issues/032-stupid-parser.md`, but nothing in
  the tree cites it.
- `i64` in `fjs/nanvm/README.md` and
  `nanvm-lib/todo/bigint-operator-test-scaffolding.md` — `f64`/`i64` spelling
  and `From<i64>`.
- `i8` in `nanvm-lib/todo/sign-algebra.md` — the sign representation.

Check the surrounding line before treating a match as a citation: a real one
reads as prose about an issue, not as a type argument.

### Related

- [`todo/README.md`](./README.md) — the four searches, and the three outcomes to
  distinguish once you have the retired file.
- [tokenizer-line-citations](../fjs/js/todo/tokenizer-line-citations.md) — the
  same shape of problem for line numbers rather than identifiers.
