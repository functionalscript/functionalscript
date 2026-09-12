## check-render-split. Corpus validation is only reachable through the renderer

**Priority:** P4
**Status:** open

### Problem

`matrix` (`module.f.mjs:500`) fuses two independent questions — "is this
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

Two exported functions with these signatures:

```ts
/** The corpus's defects; empty where it is well-formed. */
export const check: (corpus: Corpus) => readonly string[]
/** The rendered table, or the defects that stop it being rendered. */
export const matrix: (corpus: Corpus) => Result<string, readonly string[]>
```

`check` is exactly the existing failure concatenation plus the
`malformed`-first rule. `matrix` is "render if `check` came back empty":
its `ok` is unchanged; its `error` carries the **structured list**, not
today's prose — that is the one observable change, and it is the point.
It is also a **breaking change** to an exported function's result type:
a caller reading `r[1]` as a string stops compiling, so the PR declares
it with a `Changelog:` entry rather than describing it as observable
only.
`refused` keeps its wording but becomes the presentation `program` applies
to `matrix`'s error on the way to the effect edge, so the generated file
and the CLI message are byte-identical to today's. The proof asserts
against the list, and each validator can be pinned individually.

`write`/`program`/`main` are already the thin effect edge; they are not
part of this split.

### Tasks

- [ ] Export `check`; change `matrix`'s error to `readonly string[]` and
      declare the break in `Changelog:`; move `refused` to `program`.
- [ ] Re-point the proof's `refuses` at the list.
- [ ] `tsc`, `fjs test`; `npm run gen` output (`matrix.md`) unchanged.
