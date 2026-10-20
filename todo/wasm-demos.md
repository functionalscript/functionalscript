## WASM demo pages

**Priority:** P3
**Status:** wip

### Problem

FunctionalScript runs two ways: as the JavaScript it already is, and, through
`fjs compile <input> <output>.rs`, as generated Rust on the NaNVM runtime
([fjs–nanvm integration](./fjs-nanvm-integration.md)). The Rust route builds
for `wasm32`, so one FJS program can run in a web page both ways. Nothing on
the website shows that. A newcomer, or a listener at a talk, cannot see the
same source produce the same output from both, and a contributor has no page
on which to compare their performance.

### Proposal

**One page per sample program**, each a website demo. A page shows, top to
bottom:

1. **The FJS source** of the sample, highlighted as the other demos highlight
   code.
2. **The WASM disassembly** of the module the sample compiles to, as WAT text.
3. **A Run button** that runs the original JavaScript and then the WASM
   module. Each run's console output appears under its own heading. When the
   second run completes, the page shows both runs' stats side by side:
   - running time, from `performance.now`, around the call to the sample's
     entry alone. Both routes are loaded before the button is pressed, so the
     interval holds no import, fetch, compile or instantiation. The WASM
     module's startup (fetch, compile and instantiate) is shown on its own
     line, labelled as startup, never added to its running time;
   - memory, each figure labelled with what it measures, and not set side by
     side as a comparison: the two are different quantities. For the
     JavaScript run, the change in `performance.memory`'s heap across the
     run, where the browser reports it (Chromium only); that heap is the
     whole page's, so the label says so. For the WASM run, the module's
     linear memory size. "Not available" where a figure is missing, never a
     guessed value
     ([DESIGN.md §10](../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).

The audience is newcomers first and talks or pitches second, so the page
explains nothing it does not show. Contributors measuring performance use the
same page.

**The website generator never builds the demo WASM.** The WASM side lives
in a source tree of its own, beside the site code, and the site consumes its
output:

- **A demo crate** in the Cargo workspace (for example `nanvm/demos/`) holds,
  per sample, the Rust `fjs compile` writes for it and a thin hand-written
  wrapper that calls the module and wires the console to an import the page
  provides.
- **The generated Rust is committed**: the `.rs` from `fjs compile`, named
  `gen.*`, which `npm run gen` rebuilds, as NaNVM's other generated Rust is.
- **Who builds the `.wasm` and its WAT is open**, between two owners:
  - `npm run gen`, which commits them as `gen.*` files beside the `.rs`, so
    CI's stale-file check catches a sample edited without a rebuild. This
    needs a reproducible build (see below), and a `*.wasm binary` line in
    `.gitattributes`: the file's `* text eol=lf` rule would otherwise rewrite
    any CRLF bytes in the module, as the `*.ico` line there already prevents.
  - the deployment build (`gen.cloudflare/build.sh`), which already installs
    Rust and runs `cargo doc` before the website generator, and would build
    the demo crate there too. Nothing is committed, and nothing can go stale.
- **The page fetches** the `.wasm` and the WAT by their repository paths, as
  module pages already load repository files
  ([website/README.md](../fjs/website/README.md)).

### Open questions

- **The entry point.** Generated Rust answers the module's export object and
  invokes nothing. A sample needs an agreed entry, such as calling its
  `default` export with the console effect, and the JavaScript run must call
  the same one.
- **What "second run" means.** This design reads it as the WASM run, which
  follows the JavaScript one. If it means a warm-up run before a measured one,
  the Run button runs each route twice and reports the second.
- **Reproducible `.wasm`.** Committing the module works only if the pinned
  toolchain builds the same bytes every time: `npm run gen` deletes every
  `gen.*` file and rebuilds it, so a module that differs from build to build
  fails CI's drift check on every run. A hash of the inputs beside the module
  does not rescue that. The rebuild still rewrites the module, and the hash
  would have to cover every input, NaNVM's sources and the build
  configuration included. If the build is not reproducible, the module is
  built by the deployment build instead and never committed, which is the
  question under review.
- **The disassembler.** Printing WAT needs a tool or crate (for example
  `wasmprinter` or `wasm-tools`), which needs approval before it is added
  ([AGENTS.md §6](../AGENTS.md#6-external-tools)).
- **Disassembly size.** The module carries the NaNVM runtime as well as the
  sample. The page may need to show the sample's own functions first, with the
  rest collapsed.

### Tasks

- [ ] Choose two or three samples that print to the console and that
      `fjs compile … .rs` accepts today.
- [ ] Settle the entry point and who builds the `.wasm`, and add the demo
      crate with its wrapper, the `npm run gen` step that writes the `.rs`,
      and the step that builds the `.wasm` and WAT.
- [ ] Build the demo page: source, disassembly, Run button and stats.
- [ ] Add one page per sample and link them from the website.

### Related

- [WASM demo pages with rustc in the browser](./wasm-demos-in-browser-rustc.md)
  — the alternative: compile in the visitor's browser and show each IR.
- [fjs–nanvm integration](./fjs-nanvm-integration.md) — the FJS → Rust → NaNVM
  pipeline these pages run.
- [Console program](../nanvm/lib/todo/console-program.md) — the console effect
  on the native side.
- [Compiler output demos](../fjs/compiler/todo/output-demos.md) — the existing
  pages that show the generated Rust as text.
- [Bytecode to WebAssembly](../nanvm/lib/todo/056-bytecode-to-wasm.md) — a
  different route to WASM, by translating bytecode, not by building Rust.
