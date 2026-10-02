## Demo pages for the compiler's outputs

**Priority:** P3
**Status:** open

### Problem

`fjs compile` writes five outputs from one linked program — a `.json`
document, a `.data.js` document, a `.js` module, the EDAG, and generated Rust —
and the README says in prose which one refuses what. A reader cannot *see* it:
that `[a, a]` is one `const` in `.js` and `.data.js` but a plain duplicate in
JSON, that a function survives to `.js`, EDAG and Rust and is refused by the
value outputs, that a shared node makes the JSON output refuse. Only the EDAG
has a demo ([`edag/demo.f.mjs`](../edag/demo.f.mjs)); the others have none.

### Proposal

A demo is discovered by its `demo` export
([website demos](../../website/demo/types.ts)), so this is a few small modules,
not a page. One shared source box, one view per output, each a pure demo like
the EDAG one.

**One page, one source, every output.** The compiler's own pitch is "one
program, several outputs", so the demo that carries it is one text field with
the outputs side by side, not five unrelated pages. Typing `export default
[a, a]` should show all five answers at once, and the *difference* between
them is the lesson.

| Pane | Shows | Refusal looks like |
| ---- | ----- | ------------------ |
| EDAG | the existing graph drawing | n/a — EDAG takes everything |
| `.js` | `tryModuleStringify` | n/a for values; shows the emitted `const`s |
| `.data.js` | the DataJS serializer, normalized | the refusal message in place of the text |
| `.json` | `_tryJson` | the refusal message, and *why* (shared node, function, `undefined`) |
| Rust | `toRust` | the refusal message |

**A refusal is a first-class pane state, not an empty box.** A pane that cannot
spell the value says so, in the compiler's own words, tinted like a failed
proof. A blank pane is the plausible wrong answer
[DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
rules out, and the refusals are the interesting half of the comparison.

**Sharing is marked across panes.** The EDAG graph already draws a shared
`const` as one node with two incoming edges. The text panes highlight the
`const` the sharing produced, so the reader sees the same fact in the graph and
in the output.

**Examples, via the shared picker** ([`demo/examples`](../../website/demo/examples/module.f.mjs)),
each one chosen to make one output differ:

1. `export default [1, 2]` — everything agrees.
2. `const a = [1]; export default [a, a]` — sharing: `const` in `.js`, refused by JSON.
3. `export default (x) => x` — a function: `.js`/EDAG/Rust yes, value outputs refuse.
4. `export default undefined` — JSON refuses, DataJS spells it.
5. `export default 1 + 2` — folded in value outputs, an operator node in the EDAG.
6. A named-only module — the root projects to `undefined` for value output.

**Imports.** A browser has no filesystem, so the single-source box compiles one
module with no imports. Showing import linking (`resolve`) needs a virtual file
set; see the open questions rather than faking it with a hidden fixture.

### Where it lives

- `fjs/compiler/demo.f.mjs` — the side-by-side page, built on `textDemo`.
- Each output's formatting stays with its owner: the demo calls
  `tryModuleStringify`, `_tryJson`, `toRust` and the DataJS serializer. **No
  output logic is copied into the demo**; one that is not exported yet is
  exported, per [AGENTS.md §1](../../../AGENTS.md#1-workflow).
- A proof gives `demo.f.mjs` 100% coverage, driven by the examples above, so
  the examples double as a regression table of which output refuses what.

### Open questions

- **Does the page compile in the browser at all?** `transpile` is written as
  an effect over `readSource`; the demo needs it with the source supplied by
  the text box. Either the demo supplies a one-file in-memory reader
  ([`effects/node/virtual`](../../effects/node/virtual/)), or `parse` plus
  `unresolved` is enough for import-free input. The second is simpler and is
  what the EDAG demo already does; take it first.
- **Is Rust worth a pane?** It is the output the VM consumes, but long for a
  small input. A collapsed-by-default pane is the cheap answer.
- **Split `.js` and `.data.js` panes or share one?** They differ little for
  most inputs; a toggle may carry the signal better than two panes.
- **Source maps and locations.** A refusal naming a source position would
  deserve a caret in the text box; that waits on
  [investigate-edag-source-maps](./investigate-edag-source-maps.md).

### Related

- [`value-refusal-names-the-output.md`](./value-refusal-names-the-output.md) —
  the refusal wording the panes would show.
- [`named-export-sharing-precision.md`](./named-export-sharing-precision.md) —
  its example is one of the sharing cases above.
- [`../edag/demo.f.mjs`](../edag/demo.f.mjs) — the one demo that exists.
