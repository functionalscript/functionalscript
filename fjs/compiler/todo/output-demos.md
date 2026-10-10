## Demo pages for the compiler's outputs

**Priority:** P3
**Status:** open — the five stage pages and the side-by-side page are built; the open
questions remain

### Problem

`fjs compile` writes five outputs from one linked program — a `.json`
document, a `.data.js` document, a `.js` module, the EDAG, and generated Rust —
and the README says in prose which one refuses what. A reader could not *see*
it: that `[a, a]` is one `const` in `.js` and `.data.js` but a node written
twice in JSON, that a selected function survives to `.js`, EDAG and Rust and is
refused by the value outputs, or where an unsupported string escape stops.
The original comparison described `!x` and `typeof x` as front-end refusals;
both are implemented now.

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
the stage's own function (`tryModuleMarked`, `toRustMarked`, `tokenize`, `parse`).
The side-by-side page runs `_outputMarked`, the output route shared with
`compile`, over an in-memory file system, once per output name, before CLI
diagnostic formatting
([`demo.f.mjs`](../demo.f.mjs), [`module.f.mjs`](../module.f.mjs)). A file
system carries text, so the page takes the output as marked text
(`fjs/text/marked`) before it is written. JavaScript, DataJS, JSON and Rust
panes render the producer's markings.
Its [`proof.f.mjs`](../proof.f.mjs) runs the whole `compile` over the same
file system for every example and output, pins acceptance and refusal, and
holds each pane's text to the file written. See
[`text/marked/README.md`](../../text/marked/README.md#12-design-record).
**No output logic is copied into a demo**; one that is not exported yet is
exported, per
[AGENTS.md §1](../../../AGENTS.md#1-workflow).

**A refusal is shown, in the compiler's own words, not as an empty box.** An
empty pane would be the plausible wrong answer
[DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle) rules
out, and what a stage will not accept is half of what it is.

**The presets are one flat list**, [`examples/module.f.js`](../examples/module.f.js),
that all six demos — the five stages and the side-by-side page — offer whole
through the shared picker
([`website/demo/examples`](../../website/demo/examples/module.f.mjs)), which
checks that names and sources are distinct. A reader who picks "Closure" on one
page finds "Closure" on the others. The first is an overview every page opens
on. It has no import, so it needs no dependency file, but its selected function
makes the side-by-side `.json` and `.data.js` panes open on a refusal; the stage
pages and the other three output panes accept it. The list holds programs
for: primitives, string escapes, comments, objects, a repeated object key,
sharing by `const` and the repeated expression that is not shared, arithmetic,
operator precedence, logical not, `typeof`, `instanceof`, `Number` conversion,
laziness in each of its operators, a function with fixed and rest parameters,
a closure, recursion, a throwing body, an early return, shorthand members,
methods and properties, optional chaining, the entry helper, named exports,
and a failure at run time. Its front-end refusal examples are a hex escape and
an unfinished module; its imports parse and lower, but need dependency files
that the output demos do not supply. The EDAG demo's own presets were folded
into it:
[`../edag/demo.f.mjs`](../edag/demo.f.mjs) documents what each draws as.

**A name says what the program is, and each proof says what its stage
refuses.** The parser takes an import the Rust output cannot link, so "refused"
is not a property of the program. Each stage's `proof.f.mjs` walks the shared
list and pins which examples that stage refuses, so a preset that stops
behaving as its name says fails a test; the side-by-side proof is a table of
which outputs accept which example.

### What the pages show today

- The "Logical not" and "typeof" presets pass every stage and all five
  outputs, as the [side-by-side proof table](../proof.f.mjs) records. A `\x41`
  string escape stops in the tokenizer as an `error` token with a span; the
  unfinished module reaches the parser and is refused as `unexpected end`
  ([tokenizer proof](../tokenizer/proof.f.mjs),
  [parser proof](../parser/proof.f.mjs)).
- Operators and calls execute for `.json` and `.data.js`. A selected function
  is refused during output conversion; a reached failing initializer produces
  a source failure during module initialization. The side-by-side page shows
  the underlying error message; the CLI adds the input or output filename and,
  when available, a source position.
  `.js`, the EDAG and Rust preserve the computation; `undefined` is refused by
  `.json` alone.
- A shared node is one `const` in `.data.js`, `.js` and the EDAG and one
  temporary cloned at each reference in Rust, and is written where each
  reference reaches it in `.json`, which carries no identity.
- A repeated object key keeps its last value in `.json` and `.data.js` and both
  entries in `.js`, the EDAG and Rust.
- An import parses and draws in the EDAG demo as unresolved dependency reads.
  The source and Rust stage demos refuse those unbound reads
  ([EDAG proof](../edag/proof.f.mjs),
  [serializer proof](../serializer/proof.f.mjs),
  [Rust proof](../rust/proof.f.mjs)). On the side-by-side page every output
  refuses the missing dependency: its in-memory file system holds only the input.

### Open questions

- **Import linking.** The pages accept one module's source. Showing a linked
  graph or output through `resolve` needs a second file in the box; the
  in-memory file system already supports it.
- **Marking sharing across panes.** Highlighting the `const` that sharing
  produced, so the text panes and the EDAG graph show the same fact, is not
  built.
- **Rust pane length.** The Rust output is long for a small input; a
  collapsed-by-default pane on the side-by-side page is the cheap answer.
- **Source positions.** A refusal naming a position deserves a caret in the
  text box; that waits on
  [investigate-edag-source-maps](./investigate-edag-source-maps.md).

### Related

- [compiler output boundary](../README.md#ast) —
  the refusal wording the panes show.
- [`../edag/demo.f.mjs`](../edag/demo.f.mjs) — the EDAG's own demo, and what
  each shared program draws as.
