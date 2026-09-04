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

|Identifier|Retired file|Status when deleted|Bare citations|
|-|-|-|-|
|`i149`|`issues/149-sandbox.md`|—|`emergent_testing/todo/206-workers-as-a-sandbox.md` ×1|
|`i155`|`issues/155-test-runner-integration.md`|—|`emergent_testing/todo/211-reporter-modes.md` ×1, `661-test-runner-behavior.md` ×1|
|`i163`|`issues/163-reporter-test-method.md`|open|`emergent_testing/todo/211-reporter-modes.md` ×2|
|`i183`|`issues/183-tf-framework-scenario-tests.md`|open|`emergent_testing/todo/206-workers-as-a-sandbox.md` ×1, `65y-proof-asserteq-adoption.md` ×1, `65z-singleton-effect.md` ×1, `65z-tf-test-tree-walker.md` ×1|
|`i189`|`issues/189-asn1-decode-all-unfold.md`|done|`fjs/asn.1/todo/65z-asn1-tag-codec-table.md` ×1|
|`i180-sorted-set-intersect-symmetry`|`issues/180-…`|done|`fjs/types/todo/66b-sorted-list-cmp-reduce-factory.md` ×1|
|`i662`|`issues/662-rtti-ts-printer-visit.md`|open|`fjs/types/todo/66d-ts-printer-tuple-readonly-fold.md` ×1|
|`i665-mcp`|`issues/665-mcp.md`|open|`fjs/protocol/mcp/todo/README.md` ×1, `json_rpc/todo/effectful-dispatch-skeleton.md` ×1|
|`i666-utf8-continuation-helpers`|`issues/666-…`|done|`fjs/text/todo/666-utf16-encode-errormask.md` ×1|
|`i65X-sandbox-async`|`issues/65X-sandbox-async.md`|done|`emergent_testing/todo/65y-proof-asserteq-adoption.md` ×1|
|`i65Y-sandbox-await-overhead`|`issues/65Y-sandbox-await-overhead.md`|done|`emergent_testing/todo/661-sandbox-isolated-test-execution.md` ×1|
|`i65Y-proof-by-export`|`issues/65Y-proof-by-export.md`|open|`emergent_testing/todo/65y-proof-asserteq-adoption.md` ×1|

**18 bare citations across 13 files.** The column counts *bare* occurrences
only. `i665-mcp` also appears once as a working link — `mcp/todo/README.md`'s
own anchor reference to its `## 665-mcp` section — and that needs nothing. A
second such link lived in `json_rpc/todo/response-constructors.md`, which was
deleted when the constructors shipped. Regenerate the
whole column rather than trusting it — an earlier revision of this issue built
it from a scan that printed only the first two paths per identifier, and listed
two of `i183`'s four sites.

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
citation, so it should emit **18** lines:

```sh
sed -n '/^|`i/s/^|`\([^`]*\)`.*/\1/p' todo/retired-issue-identifiers.md \
| while read id; do
    grep -rn "\b$id\b" --include='*.md' . \
      | grep -v retired-issue-identifiers | grep -vE "\[$id[^]]*\]\("
  done
```

Append `| sed 's|:[0-9]*:.*||' | sort -u` for the **13** files they live in.

Line numbers are deliberately omitted. This file is an inventory of citation
rot, and pinning it to line numbers would make it rot the same way — see
[tokenizer-line-citations](../fjs/js/todo/tokenizer-line-citations.md).

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
in `fjs/bnf/todo/rule-visitor.md` — itself since retired, shipped as
`matchRule` in [`fjs/ebnf/data`](../fjs/ebnf/data/module.f.mjs) — was one
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

- [ ] Resolve the twelve identifiers above against their retired files — all
      **18** bare citations, not one per identifier; four of them are `i183`.
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
should print nothing when this issue is done. Run against the branch that filed
this issue it prints 16 lines — one per (identifier, file) pair, `i183`
contributing four — and prints nothing for any identifier already resolved.

One place the two counts differ, which is not a defect:
`fjs/protocol/mcp/todo/README.md` has a bare `i665-mcp` in its prose *and* links
it by anchor further down, so the table counts the occurrence while this check
passes the file. Rewriting it is tidying, not repair.

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
