## `@module` in `types.ts`

**Priority:** P4
**Status:** open

### Problem

[`fjs/AGENTS.md`](../fjs/AGENTS.md) §2 says the `@module` tag "belongs only to a
package's entry-point file — `module.f.mjs` / `module.mjs` — not to
`proof.f.mjs`, `types.ts`, or any other file".

90 of the 94 `types.ts` files in the tree carry it anyway. The rule and the
practice have been contradicting each other long enough that a new file copying
its neighbours lands on the wrong side of the documented convention, which is how
this was noticed: a review bot flagged `fjs/web/types.ts` for a tag every sibling
also has ([#1693](https://github.com/functionalscript/functionalscript/pull/1693)).

### Proposal

Decide which one is right, then make the tree say it once:

- if the rule is right, strip `@module` from the 90 files — a mechanical change,
  and worth checking against declaration emit first, since the leading block is
  what carries a `types.d.ts` file's documentation;
- if the practice is right, amend `fjs/AGENTS.md` to say that a `types.ts`
  companion is a module in its own right and carries the tag.

The second reading has something going for it: `types.ts` *is* the entry point of
the type-level API, and its emitted `types.d.ts` is what a package consumer
reads. Whichever way it goes, the point is that it stops being a coin flip per
file.

### Tasks

- [ ] Decide the convention.
- [ ] Apply it to every `types.ts`, or amend `fjs/AGENTS.md`.
- [ ] Make `fjs/web/types.ts` match the outcome — it is currently the minority.

### Related

- `fjs/AGENTS.md` §2 — the rule as written.
