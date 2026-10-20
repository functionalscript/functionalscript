## WASM demo pages with rustc in the browser

**Priority:** P3
**Status:** open

### Problem

[WASM demo pages](./wasm-demos.md) builds each sample's WASM ahead of time
and commits it, with a check that keeps it in step with its sample. The page
can only show a module that already exists, so a visitor cannot change the
source and see what the change does to the code, and the IR between the Rust
and the WASM is gone by the time the page loads.

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
only, so NaNVM gets there one of two ways:

- **Prebuilt:** compile `nanvm-lib` once with the same `rustc.wasm`, and ship
  its rlib beside the sysroot. An rlib only loads into the exact compiler
  build that wrote it, so it is rebuilt whenever the Weblings pin moves.
- **From source:** put NaNVM's sources into the in-memory file system as a
  second crate, and compile it with the sample. Nothing to keep in step, and
  the [spike](#spike-results) measured the cost at about four seconds, so
  this is the default.

### What it costs

- **Download.** The compiler and sysroot are about 150 MiB uncompressed
  (about 60 MiB as the zstd archives Weblings releases), loaded on the first
  Run and kept in the browser's Cache API. A talk can
  preload them; a newcomer waits once.
- **Hosting.** Files that size do not fit in the site's own static assets
  (Cloudflare Workers caps each asset file well below that). They come from
  a pinned Weblings release or another store, with the hashes pinned in the
  repository, as other Weblings users pin them in a `toolchain.lock.json`.
- **Maturity.** Weblings is experimental, one author's project. One
  application built on it,
  [rustlings-web](https://github.com/petreleon/rustlings-web), reported in
  its README on 2026-10-20 that 80 of 94 Rustlings reference solutions
  compile and run. NaNVM hits the same kind of gap: the
  [spike](#spike-results) found three operations the backend cannot lower
  yet. Each is small, but until they are fixed upstream NaNVM needs a
  workaround at every site that uses them.
- **New external tools.** Weblings, waffle and a WAT printer are external
  tools, and each needs approval before it is added
  ([AGENTS.md §6](../AGENTS.md#6-external-tools)).

### Against the ahead-of-time design

| | [Ahead of time](./wasm-demos.md) | rustc in the browser |
| - | - | - |
| Editable source | no | yes |
| Shows CLIF and waffle IR | no | CLIF yes; waffle IR needs a patch |
| Build or committed WASM | needed | none, except possibly NaNVM's rlib |
| First visit | small download | about 60 MiB compressed, then cached |
| Codegen | upstream rustc, LLVM | Cranelift through waffle, experimental |
| Running time it measures | LLVM-optimized code | Cranelift code, about 5× slower |
| Module size, all fixtures | about 1.1 MB | about 2.6 MB |

The last row matters for contributors: the in-browser route measures the
Cranelift backend, not the code a production build of NaNVM would ship. The
two designs can share a page later: precompiled WASM for the run and its
stats, and the in-browser compiler for the stages and for edited source.

### Spike results

Measured at `191e3bc` with the Weblings compiler that
[rustlings-web](https://github.com/petreleon/rustlings-web)'s
`toolchain.lock.json` pins (`AngelOnFira/wasm-rustc` release
`artifacts-test-7`: rustc 1.96.0-dev, Cranelift 0.130), run under Wasmtime
45 outside the browser.

- **It works.** With three workarounds (below) in a scratch copy of
  `nanvm-lib`, rustc in WASM compiled `nanvm-lib`, `nanvm-harness` with every
  generated fixture, and a `main` running the harness's `check` over all of
  `expected::CASES`. The module ran all 53 cases and passed every one.
- **Compile time** was about four seconds per crate (`nanvm-lib`,
  `nanvm-harness`, the `main`), with a peak of about 320 MiB. A hello world
  took a fraction of a second. These are Wasmtime's ahead-of-time numbers;
  a browser compiles the 88 MB `rustc.wasm` on load and may run it slower.
- **Run time.** The same `main` built by the repository's own toolchain
  (LLVM, `--release`, `wasm32-wasip1`) ran the cases about five times faster:
  about 1.7 ms against 8.7 ms in total, single runs. Its module was about
  1.1 MB against 2.6 MB.
- **Switches.** Weblings writes linkable objects only with
  `CLIF2WASM_OBJECT=1` in the environment; without it, linking fails on the
  allocator shim. `-C overflow-checks=off` is needed, because rustc turns
  overflow checks on at `opt-level=0`, and a checked `u64` multiply is one of
  the gaps.
- **Backend gaps.** Each refused to lower, with Weblings naming the CLIF
  instruction, and each has a minimal repro:
  - `umulhi.i64`: any overflow-checked `u64` multiply, so `u64::checked_mul`,
    `saturating_mul`, and `str::parse::<u64>()` and `::<i64>()`, which use it
    inside `core`.
  - `uextend` to `i16`: `u16::from(u8)` and `b'0' as u16`.
  - `ireduce` from `i16` to `i8`: `c as u8` on a `u16`, and
    `u8::try_from(u16)`.
  The workarounds were about twenty lines across `string_coercion`,
  `member_access`, `bigint/radix`, `string/building`, `string/debug` and
  `string/patterns`. The clean fix is in clif2wasm, upstream.
- **CLIF is available.** `--emit llvm-ir` makes the Cranelift backend write
  one `.clif` file per function, before and after its optimizer. In this
  build the compiler then panics, after the files are written.
- **waffle IR is not.** No switch for it was found in the compiler. Printing
  it needs a patch to Weblings' clif2wasm, offered upstream.

### Open questions

- **The backend gaps:** fix them in clif2wasm upstream, or carry the
  workarounds in NaNVM itself until then.
- **Getting the IR out:** a patch to Weblings that prints waffle's IR, and
  one that writes CLIF without the panic.
- **Where the compiler is hosted**, and whether that host serves it with the
  CORS headers a fetch from the site needs.
- **The WAT printer.** For example `wasmprinter` built for WASM, which can
  share the worker with the compiler.

### Tasks

- [x] Spike: compile `nanvm-lib` and the generated fixtures with Weblings,
      and record what fails, the compile time and the memory used
      ([results](#spike-results)).
- [ ] Report the three backend gaps to Weblings with their repros.
- [ ] Repeat the timings in a browser.
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
