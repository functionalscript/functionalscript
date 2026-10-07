## Demo pages for the compiler's outputs

**Priority:** P3
**Status:** wip — the five stage pages and the side-by-side page are built; the open
questions remain

### Problem

`fjs compile` writes five outputs from one linked program — a `.json`
document, a `.data.js` document, a `.js` module, the EDAG, and generated Rust —
and the README says in prose which one refuses what. A reader could not *see*
it: that `[a, a]` is one `const` in `.js` and `.data.js` but a node written
twice in JSON, that a function survives to `.js`, EDAG and Rust and is refused by the value
outputs, that `!x` stops in the tokenizer and `typeof x` in the parser.

### Design

**One demo per directory, because a page has one demo section.** The website
refuses a second module exporting `demo` in the same directory and skips both
([`website/module.f.mjs`](../../website/module.f.mjs), `resolveDemos`). So
several presets cannot be several demo files in one folder, and the layout
follows the compiler's own stages instead: each stage folder has one
`demo.f.mjs` showing *that stage's* output, and its page is where a reader of
that code lands.

| Directory | `demo.f.mjs` shows |
| --------- | ------------------ |
| `compiler/tokenizer/` | text → one line per token, an unreadable token as an `error` line |
| `compiler/parser/` | text → the AST, as DataJS text |
| `compiler/edag/` | text → the EDAG as a graph (the one that existed first) |
| `compiler/serializer/` | text → the `.js` module |
| `compiler/rust/` | text → the Rust `fjs compile` writes |
| `compiler/` | text → `.json`, `.data.js`, `.js`, `.edag.data.js` and `.rs` side by side |

`ast/` has no demo of its own: its data is what `parser/` draws.

**Each demo runs the stage it shows, never a lookalike.** The stage demos call
the stage's own function (`tryModuleStringify`, `toRust`, `tokenize`, `parse`).
The side-by-side page runs the real `compile` over an in-memory file system,
once per output name, so it cannot drift from the CLI. **No output logic is
copied into a demo**; one that is not exported yet is exported, per
[AGENTS.md §1](../../../AGENTS.md#1-workflow).

**A refusal is shown, in the compiler's own words, not as an empty box.** An
empty pane would be the plausible wrong answer
[DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle) rules
out, and what a stage will not accept is half of what it is.

**The presets are one flat list**, [`examples/module.f.js`](../examples/module.f.js),
that the tokenizer, parser, serializer, Rust and side-by-side demos each offer
whole through the shared picker
([`website/demo/examples`](../../website/demo/examples/module.f.mjs)), which
checks that names and sources are distinct. A reader who picks "Closure" on one
page finds "Closure" on the others. The list holds programs for: primitives,
string escapes, comments, objects, a repeated object key, sharing, arithmetic,
operator precedence, laziness, a function with a rest parameter, a closure,
methods and properties, named exports, and a failure at run time — and the
inputs a stage refuses: an import (no file set in a browser), `!x`, a hex
escape, `typeof x`, and an unfinished module. The EDAG demo still has a list
of its own, tuned to what its drawing has to say, and does not use this one.

**A name says what the program is, and each proof says what its stage
refuses.** The parser takes an import the Rust output cannot link, so "refused"
is not a property of the program. Each stage's `proof.f.mjs` walks the shared
list and pins which examples that stage refuses, so a preset that stops
behaving as its name says fails a test; the side-by-side proof is a table of
which outputs accept which example.

### What the pages show today

- `!x` and a `\x41` string escape stop in the tokenizer, as `error` tokens with
  a span; `typeof x` passes it as an ordinary name and the parser refuses it.
- Operators and calls now execute for `.json` and `.data.js`. A selected
  function is an output refusal, while a failing initializer names its source.
  `.js`, the EDAG and Rust preserve the computation; `undefined` is refused by
  `.json` alone.
- A shared node is one `const` in `.data.js`, `.js` and the EDAG and one
  temporary cloned at each reference in Rust, and is written where each
  reference reaches it in `.json`, which carries no identity.
- A repeated object key keeps its last value in `.json` and `.data.js` and both
  entries in `.js`, the EDAG and Rust.
- An import is refused by every output: the in-memory file system holds only
  the input.

### Open questions

- **Import linking.** The pages compile one module. Showing `resolve` needs a
  second file in the box; the in-memory file system already supports it.
- **Marking sharing across panes.** Highlighting the `const` that sharing
  produced, so the text panes and the EDAG graph show the same fact, is not
  built.
- **The EDAG demo's presets** are its own list. Moving it onto the shared list
  would finish "one program down the pipeline", at the cost of losing its
  graph-specific presets (laziness, closures with frames).
- **Rust pane length.** The Rust output is long for a small input; a
  collapsed-by-default pane on the side-by-side page is the cheap answer.
- **Source positions.** A refusal naming a position deserves a caret in the
  text box; that waits on
  [investigate-edag-source-maps](./investigate-edag-source-maps.md).

### Related

- [compiler output boundary](../README.md#ast) —
  the refusal wording the panes show.
- [`../edag/demo.f.mjs`](../edag/demo.f.mjs) — the EDAG's own demo, with its own
  presets.
