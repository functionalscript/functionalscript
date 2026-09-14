## check-render-split. Corpus validation is only reachable through the renderer

**Priority:** P4
**Status:** open

### Problem

`matrix` fuses two independent questions — "is this
corpus well-formed" and "what does its table look like": it runs
`malformed` first, then collects `roleless`/`unrenderable`/`ambiguous`/
`duplicated`/`stale` plus the per-row errors, and only then assembles the
Markdown — with `refused` flattening every structured failure into one
`\n`-joined blob on the way out. The whole-corpus validators never read
a rendered cell, and the table is assembled only after all of them
pass — but the per-cell check is not separate at all: `cell` decides
what a cell *is* (the role's sets have not landed, it has vectors, it
has a reason, or it is empty with no answer, which is the failure) and
spells that decision as Markdown in the same function, so the per-row
failures exist today only as a by-product of rendering every row. Neither
question can be asked without the other.

The proof shows the cost: its only way to ask "is this corpus valid?" is
to render and substring-match —

```js
// proof.f.mjs, refuses
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
/** The corpus's defects, `also` (defects found outside the table) first; empty where it is well-formed. */
export const check: (corpus: Corpus, also?: readonly string[]) => readonly string[]
/** The rendered table, or the defects that stop it being rendered. */
export const matrix: (corpus: Corpus, also?: readonly string[]) => Result<string, readonly string[]>
```

The split runs through `cell`. Its decision becomes a private
`classify: (corpus, role, c) => Result<Classification, string>` over a
small tagged type — the sets not landed, the ids the role has for the
class, or the index of the reason it gives — and the four spellings
(`*awaiting the set*`, the ids in code spans, `not applicable` with its
note, and nothing for the failure) become a private renderer over that
type. `check` is then the `malformed`-first rule, the whole-corpus
validators, and `classify`'s failures folded over every role and class —
no string of the table is built to find them — with `also` riding
alongside in both branches as it does today: `matrix`'s `also` parameter
(the source-document defects `program` gathers with `sourceDefect`) moves
onto `check` unchanged, since it is validation input, not rendering
input. `matrix` is "render if `check` came back empty", rendering the
classifications rather than re-deciding them: its `ok` is unchanged; its
`error` carries the **structured list**, not today's prose — that is the
one observable change, and it is the point.
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

- [ ] Split `cell` into `classify` and its renderer; export `check` over
      `classify`; change `matrix`'s error to `readonly string[]` and
      declare the break in `Changelog:`; move `refused` to `program`.
- [ ] Re-point the proof's `refuses` at the list.
- [ ] `tsc`, `fjs test`; `npm run gen` output (`matrix.md`) unchanged.
