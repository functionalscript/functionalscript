## check-render-split. Corpus validation is only reachable through the renderer

**Priority:** P4
**Status:** open

### Problem

`matrix` (`module.f.mjs:478`) fuses two independent questions — "is this
corpus well-formed" and "what does its table look like": it runs
`malformed` first, then collects `roleless`/`unrenderable`/`ambiguous`/
`duplicated`/`stale` plus the per-row errors, and only then assembles the
Markdown — with `refused` flattening every structured failure into one
`\n`-joined blob on the way out. The validators never read a rendered
cell and the renderer runs only after all of them pass, yet neither can
be exercised without the other.

The proof shows the cost: its only way to ask "is this corpus valid?" is
to render and substring-match —

```js
// proof.f.mjs:40-50
const refuses = (c, ...expected) => {
    const r = failure(c)          // matrix(c), asserted to be an error
    for (const e of expected) { assert(r.includes(e), …) }
}
```

so every validation assertion in the proof is a search over prose, and a
future consumer that wants corpus linting without regenerating
`matrix.md` has nothing to call.

### Proposal

Export the validation as its own function — `check(corpus): readonly
string[]` (empty means valid), which is exactly the existing failure
concatenation plus the `malformed`-first rule — and leave `matrix` as
"render if `check` came back empty", where the renderer is total because
`check` passed. `refused` becomes pure presentation used only by
`program`. The proof then asserts against the array of messages instead
of a blob, and each validator can be pinned individually.

`write`/`program`/`main` are already the thin effect edge; they are not
part of this split.

### Tasks

- [ ] Extract and export `check`; re-express `matrix` through it.
- [ ] Re-point the proof's `refuses` at `check`'s array.
- [ ] `tsc`, `fjs test`; `npm run gen` output (`matrix.md`) unchanged.
