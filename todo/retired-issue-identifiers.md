## Resolve the remaining bare `iNNN` citations

**Priority:** P4
**Status:** open

### Problem

Citations to the retired tracker survive across the tree as bare identifiers —
`i163`, `i183`, `i189` and so on. [#1692](https://github.com/functionalscript/functionalscript/pull/1692)
resolved the ones it had claimed were untraceable and documented the search that
finds them ([`todo/README.md`](./README.md), "Retired `iNNN` identifiers"), but
stopped there rather than widening further. This issue is the remainder.

The claim that a bare identifier has "no file left to point at" was wrong. The
retired tracker was a top-level `issues/` directory of `issues/NNN-{slug}.md`
files, and deleting them removed them from the working tree, not from history.
Every cited identifier below has a file:

|Identifier|Retired file|Status when deleted|Bare citations|
|-|-|-|-|
|`i149`|`issues/149-sandbox.md`|—|`emergent_testing/todo/206-workers-as-a-sandbox.md` ×1|
|`i155`|`issues/155-test-runner-integration.md`|—|`emergent_testing/todo/211-reporter-modes.md` ×1, `661-test-runner-behavior.md` ×1|
|`i163`|`issues/163-reporter-test-method.md`|open|`emergent_testing/todo/211-reporter-modes.md` ×2|
|`i183`|`issues/183-tf-framework-scenario-tests.md`|open|`emergent_testing/todo/206-workers-as-a-sandbox.md` ×1, `65y-proof-asserteq-adoption.md` ×1, `65z-singleton-effect.md` ×1, `65z-tf-test-tree-walker.md` ×1|
|`i189`|`issues/189-asn1-decode-all-unfold.md`|done|`fjs/asn.1/todo/65z-asn1-tag-codec-table.md` ×1|
|`i666-utf8-continuation-helpers`|`issues/666-…`|done|`fjs/text/todo/666-utf16-encode-errormask.md` ×1|
|`i65X-sandbox-async`|`issues/65X-sandbox-async.md`|done|`emergent_testing/todo/65y-proof-asserteq-adoption.md` ×1|
|`i65Y-proof-by-export`|`issues/65Y-proof-by-export.md`|open|`emergent_testing/todo/65y-proof-asserteq-adoption.md` ×1|

At `0a5bc32`, **thirteen bare citations across eight files.** The column
counts *bare* occurrences only. Three rows have left the table since it was
filed, resolved when the issues citing them moved:
`i180-sorted-set-intersect-symmetry` (the citation was dropped from
`fjs/types/sorted_list/todo/cmp-reduce-factory.md`), `i662` (written in the
retired form in `fjs/types/ts/todo/tuple-readonly.md`) and `i665-mcp` (split
into `fjs/protocol/mcp/todo/roadmap.md`, which its citers now link).
Regenerate the whole column rather than trusting it — an earlier revision of
this issue built it from a scan that printed only the first two paths per
identifier, and listed two of `i183`'s four sites.

Run this from the repo root. The identifier list is read out of the table's own
first column rather than repeated, so the check cannot go stale against the
rows it is checking:

```sh
sed -n '/^|`i/s/^|`\([^`]*\)`.*/\1/p' todo/retired-issue-identifiers.md \
| while read id; do
    printf '%-36s' "$id"
    grep -rn "\b$id\b" --include='*.md' . \
      | grep -v retired-issue-identifiers \
      | grep -vE "\[$id[^]]*\]\(" \
      | sed 's|:[0-9]*:.*||' | sort | uniq -c | tr '\n' ' '
    echo
  done
```

Two details carry the weight. The `grep -vE` separates a bare citation from one
that is already a link — without it `i665-mcp` reads as four sites when two of
them are done. And the `sed` reads the identifiers from the table, so adding or
removing a row changes what gets checked; an earlier revision hard-coded seven
of the twelve, which is the failure this form exists to prevent.

For the totals, drop the per-identifier grouping. This prints one line per bare
citation, so at `0a5bc32` it emits thirteen lines:

```sh
sed -n '/^|`i/s/^|`\([^`]*\)`.*/\1/p' todo/retired-issue-identifiers.md \
| while read id; do
    grep -rn "\b$id\b" --include='*.md' . \
      | grep -v retired-issue-identifiers | grep -vE "\[$id[^]]*\]\("
  done
```

Append `| sed 's|:[0-9]*:.*||' | sort -u` for the eight files they live in.

Line numbers are deliberately omitted. This file is an inventory of citation
rot, and pinning it to line numbers would make it rot the same way.

Finding the file is mechanical. Deciding what the citation should say instead is
not, and both outcomes occur:

- **It migrated.** `i665-mcp` became the MCP roadmap, now
  [`fjs/protocol/mcp/todo/roadmap.md`](../fjs/protocol/mcp/todo/roadmap.md);
  once its citers linked it, the row was done.
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
requires, and a citation to one is left just as bare. The worked example was
`nullable-analysis-shared`, cited bare from the `rule-visitor` issue after it
had shipped as `emptyTagMap` — now in
[`fjs/ebnf/data`](../fjs/ebnf/data/module.f.mjs) — and its file had been
deleted in the same change. `rule-visitor` has since been retired too, shipped
as `matchRule` in the same module, so neither is left to repair. The same
search finds such citations, against the todo path rather than `issues/`:

```sh
git log --all --format='%h %s' --diff-filter=D -- '*nullable-analysis-shared*'
```

A deleting commit's message usually names both what shipped and the deletion,
which is the whole answer. This issue does not enumerate that class.

### Proposal

For each row: read the retired file (the README's search 1), decide which of the
three outcomes applies — open under a new slug, shipped as code, or won't fix —
and rewrite every citation to name it. Where nothing survives, either restore
the file under `{slug-kebab}.md` or delete the reference; do not leave a bare
identifier behind, since the next reader has no way to tell "unresolved" from
"unresolvable".

### Tasks

- [ ] Resolve the identifiers above against their retired files — every bare
      citation, not one per identifier; four of them are `i183`.
- [ ] Decide `i65Y-proof-by-export`: restore it or drop its citation.
- [ ] Sweep for slug-named deletions the same way, per the section above.
- [ ] Re-run the check below; it should print nothing.

### Checking that a resolution took

The identifier does **not** disappear when you resolve it — the documented form
keeps it and names the target beside it, because the target is often code rather
than a document. So "no bare `iNNN` left" is the wrong finishing condition; an
earlier revision of this issue used it, and it would have reported every
correctly-resolved citation as outstanding. A resolution takes one of two forms:

```md
- [i167](../fjs/types/bit_vec/module.f.mjs) — the identifier as a link label,
  where a document survives to link to.
- i143 (retired; shipped as [`fjs/rtti/data/`](../fjs/rtti/data/module.f.mjs))
  — the identifier with `retired` beside it and the target named, for code.
- the retired `i171` … resolved **won't fix**, reason in `parseTestSet`'s JSDoc.
```

The targets above are relative to *this* file, in `todo/`. Re-base them against
whatever file you are editing instead of copying them across.

The word `retired` is what makes the second form checkable, so write it. The
check is then per *file*, not per occurrence: a file has resolved an identifier
once it names the target, and later mentions in the same file may be shorthand.

```sh
sed -n '/^|`i/s/^|`\([^`]*\)`.*/\1/p' todo/retired-issue-identifiers.md \
| while read id; do
    comm -23 \
      <(grep -rl "\b$id\b" --include='*.md' . \
        | grep -vE 'retired-issue-identifiers|todo/README.md' | sort) \
      <(grep -rlE "\[$id[^]]*\]\(|$id.{0,60}retired|retired.{0,60}$id" \
          --include='*.md' . | sort)
  done
```

It prints every file that still cites an identifier without resolving it, and
should print nothing when this issue is done. At `0a5bc32` it prints twelve
lines — one per (identifier, file) pair, `i183` contributing four — and
prints nothing for any identifier already resolved.

### Caveat for whoever sweeps this

`\bi\d+\b` matches Rust and Wasm integer type names and CPU architecture
names, and the collision is not theoretical — an earlier revision of this issue
listed one of them as a citation to repair. None of these is a citation:

- Rust integer types: `i8` in `nanvm-lib/todo/sign-algebra.md` (the sign
  representation); `i32` in `nanvm-lib/todo/numeric-binary-operator-zip.md`
  (the `int32_op` signature); `i64` in `fjs/nanvm/README.md` and
  `nanvm-lib/todo/bigint-operator-test-scaffolding.md` (`f64`/`i64` spelling
  and `From<i64>`); `i64` and `i128` in `spec/datajs/vectors/README.md`.
- CPU architectures: `i386` and `i686` in `fjs/ci/README.md` and
  `fjs/ci/todo/65z-ci-nix.md`, and the `i686-…` target triples in `fjs/ci`
  source.

Check the surrounding line before treating a match as a citation: a real one
reads as prose about an issue, not as a type argument.

### Related

- [`todo/README.md`](./README.md) — the four searches, and the three outcomes to
  distinguish once you have the retired file.
