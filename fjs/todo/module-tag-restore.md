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

98 of those 102 files had real prose in the block. Their module documentation is
still in the source and is now invisible to `deno doc`, which
[`../website/todo/publish-deno-doc-to-website.md`](../website/todo/publish-deno-doc-to-website.md)
plans to publish. Nothing is broken at runtime; what is lost is the description
of 89 type-level APIs in generated documentation.

[`../AGENTS.md`](../AGENTS.md) §2 now states the rule correctly — the tag goes
wherever a file has module-level documentation to publish. This issue is the
tree catching up.

### Proposal

Three groups, and only the first is mechanical.

**1. Restore — 89 `types.ts`, all with prose.** Put `@module` back in the
leading block. `types.ts` is the entry point of the type-level API and its
emitted declarations are what a package consumer reads, so this is squarely
"documentation to publish". The exact text is recoverable per file:

```sh
git show 0233904^:<path>
```

**2. Decide — 11 proof files** (8 with prose, 3 with a bare tag). Proof
documentation is not published, so by the rule the tag buys nothing and they
should stay as they are. Worth confirming rather than assuming: if `deno doc`
is ever pointed at proofs, or a reader is expected to browse them, the answer
flips. The three bare-tag ones lost nothing either way.

**3. Judge individually — two files that are neither.**

- `fjs/bnf/testlib.f.mjs` — its block held only `@import` tags, no prose. Under
  the rule there is nothing to attach, so it wants no tag. Nothing to restore.
- `fjs/emergent_testing/browser.mjs` — real prose ("Browser-native proof
  execution and report rendering", and why it has no Node dependencies). It is
  a published module in the package, so it reads like group 1.

### Tasks

- [ ] Restore the tag in the 89 `types.ts` files.
- [ ] Restore `fjs/emergent_testing/browser.mjs`; leave `fjs/bnf/testlib.f.mjs`.
- [ ] Decide the proof files, and record the decision in
      [`../AGENTS.md`](../AGENTS.md) §2 rather than only here.
- [ ] Drop §2's paragraph saying the tree does not obey the rule yet.
- [ ] Spot-check with `deno doc --json` on a restored file that `module_doc`
      comes back, rather than trusting the edit.

### Related

- [`../AGENTS.md`](../AGENTS.md) §2 — the rule, and why the tag exists.
- [`../website/todo/publish-deno-doc-to-website.md`](../website/todo/publish-deno-doc-to-website.md)
  — what makes this visible rather than theoretical.
- [`../../todo/jsdoc-verification.md`](../../todo/jsdoc-verification.md) — how a
  rule like this might be checked at all, which is why it drifted twice unnoticed.
