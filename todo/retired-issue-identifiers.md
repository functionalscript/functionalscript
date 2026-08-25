## retired-issue-identifiers. Resolve the remaining bare `iNNN` citations

**Priority:** P4
**Status:** open

### Problem

Citations to the retired tracker survive across the tree as bare identifiers —
`i163`, `i183`, `i32`, `i662` and so on. [#1692](https://github.com/functionalscript/functionalscript/pull/1692)
resolved the ones it had claimed were untraceable and documented the search that
finds them ([`todo/README.md`](./README.md), "Retired `iNNN` identifiers"), but
stopped there rather than widening further. This issue is the remainder.

The claim that a bare identifier has "no file left to point at" was wrong. The
retired tracker was a top-level `issues/` directory of `issues/NNN-{slug}.md`
files, and deleting them removed them from the working tree, not from history.
Every cited identifier below has a file:

|Identifier|Retired file|Status when deleted|Cited in|
|-|-|-|-|
|`i32`|`issues/032-stupid-parser.md`|open|`fjs/text/README.md`|
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

### Proposal

For each row: read the retired file (the README's search 1), decide which of the
three outcomes applies — open under a new slug, shipped as code, or won't fix —
and rewrite every citation to name it. Where nothing survives, either restore
the file under `{slug-kebab}.md` or delete the reference; do not leave a bare
identifier behind, since the next reader has no way to tell "unresolved" from
"unresolvable".

### Tasks

- [ ] Resolve the thirteen identifiers above against their retired files.
- [ ] Decide `i65Y-proof-by-export`: restore it or drop its citation.
- [ ] Re-run the sweep afterwards; the only `i…` tokens left should be Rust
      integer types.

### Caveat for whoever sweeps this

`\bi\d+\b` matches Rust's integer types. `i64` in `fjs/nanvm/README.md` and
`nanvm-lib/todo/bigint-operator-test-scaffolding.md`, and `i8` in
`nanvm-lib/todo/sign-algebra.md`, are `f64`/`i64`/`i8` in prose about Rust, not
issue citations. They are the only two such collisions today.

### Related

- [`todo/README.md`](./README.md) — the four searches, and the three outcomes to
  distinguish once you have the retired file.
- [tokenizer-line-citations](../fjs/js/todo/tokenizer-line-citations.md) — the
  same shape of problem for line numbers rather than identifiers.
