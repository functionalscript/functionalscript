## `ranked` and `layout` keep each `let` in the body that declares it

**Priority:** P5
**Status:** open

### Problem

[`fjs/AGENTS.md` §3.1](../../../../AGENTS.md#31-immutability-and-purity) says
"Use `let` variables only within the function body where they are declared".
Two functions in [`../module.f.mjs`](../module.f.mjs) write theirs from a
callback instead:

- `ranked` declares `changed` in its loop and sets it inside the
  `current.map` callback, which is how a round learns that some rank moved.
- `layout` declares `y` and advances it inside the `rows.map` callback, and
  declares `x` there and advances it inside the nested `row.map` callback:
  the running offsets of the next row and the next slot.

Each works only because `map` calls its callback in order and at once, a
fact about the host's `Array.prototype.map` that the code leans on without
saying so.

### Proposal

Carry the running value through the iteration instead of writing it from
inside. `layout`'s offsets are a `reduce` over the rows and over each row's
slots, carrying `y` and `x` with what has been placed so far. `ranked`'s
round can compute the new ranks with `map` and compare them with the old ones
after, or fold a `changed` flag through a `reduce`. `ranked`'s JSDoc records
a measured regression from an earlier rewrite, so measure it on the DataJS
demo again.

### Tasks

- [ ] `layout`: thread `y` and `x` through a `reduce`.
- [ ] `ranked`: decide `changed` outside the callback; re-measure on the
      DataJS demo.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`fjs/git/oid/todo/chunk-gathering.md`](../../../../git/oid/todo/chunk-gathering.md)
  — `chunks` writes its `let`s from an `Array.from` callback the same way.
