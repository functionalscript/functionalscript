## WASM demo pages with rustc in the browser

**Priority:** P3
**Status:** open

### Problem

[WASM demo pages](./wasm-demos.md) builds each sample's WASM ahead of time,
which leaves two questions open: where the build runs (committed `gen.*`
files, or the Cloudflare deployment build), and how a committed module is
kept in step with its sample. Either way the page can only show a module that
already exists, so a visitor cannot change the source and see what the change
does to the code.

This is an alternative: compile in the visitor's browser, with a Rust
compiler that runs as WASM, and show each stage of the compilation, not only
the result. The stages are what a visitor learns from. They show what the
FJS → Rust → NaNVM route costs today and where it could be optimized later.

### Proposal

**Every stage runs in the browser.** `fjs compile` is FunctionalScript, so
the browser already runs it. [Weblings](https://github.com/AngelOnFira/weblings)
(MIT) supplies the rest. It is rustc built for WASM from bjorn3's patches,
with the Cranelift backend and a `wasip1` sysroot, running in a Web Worker
over an in-memory WASI file system. Its pipeline is:

```text
rust source → rustc (rustc_codegen_cranelift) → Cranelift IR (CLIF)
            → clif2wasm → waffle IR → WASM object → riwl linker → .wasm
```

So the whole route a page runs is:

```text
FJS source → fjs compile → Rust → CLIF → waffle IR → WASM → run
```

**A page shows each stage the pipeline passes through**, in tabs or
collapsible panes, under the FJS source:

1. **The FJS source.** It is editable, since nothing about it is precompiled.
2. **The generated Rust**, as the [compiler's Rust demo](../fjs/compiler/todo/output-demos.md)
   already shows it.
3. **The Cranelift IR** that rustc's Cranelift backend produces.
4. **The waffle IR** that [waffle](https://docs.rs/waffle) holds before
   writing WASM: an SSA graph of blocks with block parameters, one operator
   per WASM operator.
5. **The WASM disassembly**, as WAT.
6. **The run**: the Run button, the console output of both routes, and the
   stats [WASM demo pages](./wasm-demos.md#proposal) defines (running time
   around the entry call alone, memory figures labelled with what they
   measure). Compile time gets a row of its own per stage, because it is
   what this design adds and what a visitor waits for.

Each IR pane shows **the sample's own functions first**. The rest of the
program, NaNVM and `std`, is collapsed, because it is most of the text and
the same for every sample.

**Nothing is built or committed ahead of time except NaNVM**, which has no
dependencies of its own. Weblings links against the bundled `std` rlibs
only, so NaNVM gets there one of two ways, and the spike decides which:

- **Prebuilt:** compile `nanvm-lib` once with the same `rustc.wasm`, and ship
  its rlib beside the sysroot. An rlib only loads into the exact compiler
  build that wrote it, so it is rebuilt whenever the Weblings pin moves.
- **From source:** put NaNVM's sources into the in-memory file system as a
  second crate, and compile it with the sample. Nothing to keep in step, but
  every first visit pays for compiling the whole runtime.

### What it costs

- **Download.** The compiler and sysroot are about 150 MiB uncompressed,
  loaded on the first Run and kept in the browser's Cache API. A talk can
  preload them; a newcomer waits once.
- **Hosting.** Files that size do not fit in the site's own static assets
  (Cloudflare Workers caps each asset file well below that). They come from
  a pinned Weblings release or another store, with the hashes pinned in the
  repository, as other Weblings users pin them in a `toolchain.lock.json`.
- **Maturity.** Weblings is experimental, one author's project. One
  application built on it reports that 80 of 94 Rustlings reference
  solutions compile and run, and the rest hit backend codegen gaps. NaNVM is
  heavily generic Rust, so it may hit the same gaps. The design depends on
  it not doing so, or on the gaps being fixable upstream.
- **New external tools.** Weblings, waffle and a WAT printer are external
  tools, and each needs approval before it is added
  ([AGENTS.md §6](../AGENTS.md#6-external-tools)).

### Against the ahead-of-time design

| | [Ahead of time](./wasm-demos.md) | rustc in the browser |
| - | - | - |
| Editable source | no | yes |
| Shows CLIF and waffle IR | no | yes |
| Build or committed WASM | needed | none, except possibly NaNVM's rlib |
| First visit | small download | about 150 MiB, then cached |
| Codegen | upstream rustc, LLVM | Cranelift through waffle, experimental |
| Running time it measures | LLVM-optimized code | Cranelift code, likely slower |

The last row matters for contributors: the in-browser route measures the
Cranelift backend, not the code a production build of NaNVM would ship. The
two designs can share a page later: precompiled WASM for the run and its
stats, and the in-browser compiler for the stages and for edited source.

### Open questions

- **Which IRs Weblings can hand over.** rustc_codegen_cranelift can write
  the CLIF it produces, and waffle can print its IR, but the page needs both
  out of the Weblings worker as text. If Weblings does not expose them, it
  needs a patch, offered upstream.
- **How NaNVM reaches the compiler**, prebuilt or from source, as above.
- **Where the compiler is hosted**, and whether that host serves it with the
  CORS headers a fetch from the site needs.
- **The WAT printer.** For example `wasmprinter` built for WASM, which can
  share the worker with the compiler.

### Tasks

- [ ] Spike: compile `nanvm-lib` and one generated sample with Weblings, in
      Node or a browser, and record what fails, the compile time and the
      memory used. Everything below depends on this.
- [ ] Get CLIF and waffle IR out of the Weblings worker as text.
- [ ] Settle hosting and pin the compiler assets by hash.
- [ ] Build the page: stages, Run, stats.

### Related

- [WASM demo pages](./wasm-demos.md) — the ahead-of-time design this is an
  alternative to; the page layout and stats are shared.
- [fjs–nanvm integration](./fjs-nanvm-integration.md) — the FJS → Rust →
  NaNVM route both designs run.
- [Compiler output demos](../fjs/compiler/todo/output-demos.md) — the existing
  page that shows the generated Rust.
