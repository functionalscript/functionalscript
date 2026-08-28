## module-tag-restore. Put `@module` back where documentation is published

**Priority:** P3
**Status:** open

### Problem

[#1756](https://github.com/functionalscript/functionalscript/pull/1756) stripped
`@module` from 102 files, on the reading that the tag marks a package entry
point. That reading was wrong. The tag is what makes a leading JSDoc block *be*
module documentation: `deno doc` emits `module_doc` for a file carrying it and
nothing at all for a file without it — the block is dropped, not demoted.
Verified against the pinned Deno, for `.mjs` and `.ts` alike.

98 of those 102 files had real prose in the block, and
[#1750](https://github.com/functionalscript/functionalscript/pull/1750) did the
same to 16 `private.ts` on the same reading — all 16 have prose and none carry
the tag. Their module documentation is still in the source and `deno doc` cannot
see it. Nothing is broken at runtime.

The tag is necessary, not sufficient.
[`../website/todo/publish-deno-doc-to-website.md`](../website/todo/publish-deno-doc-to-website.md)
currently plans `deno doc --html **/module.f.mjs`, a glob that excludes every
`types.ts` and `private.ts`, so restoring the tag alone would not put these
descriptions on the website. Restoring it is what makes them *available* to be
read at all; where they are then shown is a separate decision, and it is not the
same decision for the two file kinds.

**`types.ts` yes, `private.ts` no.** `types.ts` is the public type-level API, so
widening that glob to reach it belongs to the website issue. `private.ts` holds
implementation-private types outside the public declaration closure, and
[`separate-private-types.md`](./separate-private-types.md) plans to drop its
generated declarations from the package in Stage 2 — putting them on the public
API site would publish exactly what that design removes. Its prose is worth the
tag for contributors reading the sources or running `deno doc` themselves; it is
not website input.

[`../AGENTS.md`](../AGENTS.md) §2 now states the rule correctly — the tag goes
wherever a file has module-level documentation a reader is meant to get from
`deno doc`, whoever that reader is. This issue is the tree catching up.

### Proposal

Four groups, and the first two are mechanical.

**1. Restore — 89 `types.ts`, all with prose.** Put `@module` back in the
leading block. `types.ts` is the entry point of the type-level API and its
emitted declarations are what a package consumer reads, so this is squarely
documentation a reader is meant to get. The exact text is recoverable per file:

```sh
git show 0233904^:<path>
```

**2. Restore — 16 `private.ts`, all with prose.** Stripped by #1750 rather than
#1756, so they are not in the 102, but the same reading and the same fix.
`../AGENTS.md` §2 names `private.ts` alongside `types.ts`, and now says why the
audience is not the same one: the tag makes the prose reachable by `deno doc` for
a contributor, and the public site must stay pointed away from these files. Do
not carry this group into the website glob.

**3. Leave — 11 proof files** (8 with prose, 3 with a bare tag). Proof
documentation is not published, so by the rule the tag has nothing to attach to,
and `../AGENTS.md` §1.2's proof example now shows a block without it. Worth
confirming rather than assuming: if `deno doc` is ever pointed at proofs, the
answer flips. The three bare-tag ones lost nothing either way.

**4. Judge individually — two files that are neither.**

- `fjs/bnf/testlib.f.mjs` — its block held only `@import` tags, no prose. Under
  the rule there is nothing to attach, so it wants no tag. Nothing to restore.
- `fjs/emergent_testing/browser.mjs` — real prose ("Browser-native proof
  execution and report rendering", and why it has no Node dependencies). It is
  a published module in the package, so it reads like group 1.

### Tasks

- [ ] Restore the tag in the 89 `types.ts` files.
- [ ] Restore it in the 16 `private.ts` files, without adding them to any public
      documentation build.
- [ ] Restore `fjs/emergent_testing/browser.mjs`; leave `fjs/bnf/testlib.f.mjs`.
- [ ] Confirm the proof decision, and record it in
      [`../AGENTS.md`](../AGENTS.md) §2 rather than only here.
- [ ] Correct the copy of the old rule in
      [`../../todo/migrate-typescript-to-mjs.md`](../../todo/migrate-typescript-to-mjs.md)
      ("Module header and import ordering"), which still states the tag belongs
      only to an entry point — it was restated there rather than linked, so it
      did not move when §2 did.
- [ ] Drop §2's paragraph saying the tree does not obey the rule yet, once it
      does.
- [ ] Spot-check with `deno doc --json` on a restored file that `module_doc`
      comes back, rather than trusting the edit.

### Related

- [`../AGENTS.md`](../AGENTS.md) §2 — the rule, and why the tag exists.
- [`../website/todo/publish-deno-doc-to-website.md`](../website/todo/publish-deno-doc-to-website.md)
  — the other half for group 1: its `**/module.f.mjs` glob would have to widen to
  `types.ts` before those descriptions reach a website reader. Not to
  `private.ts`.
- [`separate-private-types.md`](./separate-private-types.md) — why `private.ts`
  is contributor-facing only, and why Stage 2 drops its declarations from the
  package.
- [`../../todo/jsdoc-verification.md`](../../todo/jsdoc-verification.md) — how a
  rule like this might be checked at all, which is why it drifted twice unnoticed.
