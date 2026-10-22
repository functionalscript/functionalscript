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
2. **The Rust** `fjs compile` writes for it, the committed `.rs` the module is
   built from.
3. **The WASM disassembly** of the module the sample compiles to, as WAT text.
4. **A Run button** that runs the original JavaScript and then the WASM
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
     linear memory size. A figure the browser does not report is left out,
     never a guessed value
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
- **The deployment build makes the `.wasm` and its WAT.**
  `gen.cloudflare/build.sh` already installs Rust and runs `cargo doc` before
  the website generator, so it builds the demo crate for `wasm32` there too.
  The script is generated: the steps go in `buildText()` in
  [`fjs/website/cloudflare`](../fjs/website/cloudflare/module.f.mjs), whose
  proof pins the text.
  Neither file is committed: they are gitignored output, like the site's
  `index.html` files, so nothing can go stale and no reproducible build is
  needed. Committing them was the other option. It would need byte-identical
  rebuilds, because `npm run gen` deletes and rebuilds every `gen.*` file, and
  a `*.wasm binary` line in `.gitattributes`.
- **The page fetches** the `.wasm` and the WAT by the paths the deployment
  build writes them to, as module pages already load files from the served
  tree ([website/README.md](../fjs/website/README.md)).

### Status

The first page, [`fjs/nanvm/demos/hello`](../fjs/nanvm/demos/hello/), is
built:

- **The entry point** is the sample's `default` export, called with no
  arguments, answering the effect the page performs. The JavaScript run
  performs it in memory with `effects/mock`, keeping standard output; the
  WASM run loads the sample with its export in `nanvm-demos`, untimed, as the
  JavaScript module was imported before the run, then times `run_sample`,
  which performs it on `nanvm-effects-node`'s host and keeps standard output
  for the page to read back with `output_byte`.
- **The page** is [`fjs/nanvm/demos/page`](../fjs/nanvm/demos/page/module.f.mjs),
  a demo over two new browser operations,
  [`effects/browser`](../fjs/effects/browser/types.ts)'s `fetchText` and
  `instantiate`.
- **The deployment build** adds the `wasm32-unknown-unknown` target, builds
  `nanvm-demos`, and `nanvm-demos-publish` copies the module to
  `nanvm/demos/_build/`, which git ignores and the site serves, and prints
  each sample's WAT beside it with the `wasmprinter` crate, which Sasha
  approved. The WAT holds only the functions Rust compiled from the sample's
  module, picked by their names in the module's name section, read with
  `wasmparser` and demangled with `rustc-demangle`, which Sasha also
  approved. NaNVM and `std` are most of the module, the same for every
  sample, and left out. The WAT names every function as Rust does, since
  the name section is demangled before it is printed.
- **A second page, [`fjs/nanvm/demos/sort`](../fjs/nanvm/demos/sort/)**,
  sorts 100,000 pseudo-random integers with a quicksort written in the
  sample, and writes what it sorted. The page shows the WebAssembly running
  time as a multiple of the JavaScript one. In headless Chromium the JavaScript
  run takes about 250 ms and the WebAssembly run about 2.1 s, so the NaNVM
  route is about nine times slower on this sample, which allocates a new
  array at every step. The sample encodes its own
  output to bytes, with `charCodeAt` and a loop, since `utf8` does not
  compile.
- **A third page, [`fjs/nanvm/demos/collatz`](../fjs/nanvm/demos/collatz/)**,
  finds the start below 30,000 with the longest Collatz chain: arithmetic on
  numbers alone, with no allocation while it searches, since a chain's
  length and start travel as one number. In headless Chromium the
  JavaScript run takes about 35 ms and the WebAssembly run about 1.7 s,
  about fifty times slower, with 1.1 MB of linear memory against the sort's
  9.5 MB: the cost is NaNVM's calls and dynamic values, not allocation.
- **`fjs compile` gaps the sort sample worked around**:
  - `a[i]` is refused (`computed key is not Number(...)`): an index computed
    at run time is written `a[Number(i)]`.
  - A `const` read only past a guard, in one branch of `?:`, has no Rust
    spelling ("a shared node reached only through lazy operands"): the pivot
    is passed to a nested function instead.
  - A module `const` cannot name one declared after it (`const not found`),
    so two module functions cannot call each other: the quicksort's step is
    nested inside it.
  - `let` needs a JSDoc type for TypeScript where its tuple mixes `number`
    and `bigint`; a gap of the type check, not of the compiler.
- **Not yet:** the JavaScript memory figure, and the sample's use of `log` and `utf8`, which
  `fjs compile` cannot compile yet, so the sample builds its `write` command
  by hand.

### Alternative

[WASM demo pages with rustc in the browser](./wasm-demos-in-browser-rustc.md)
compiles each sample in the visitor's browser with Weblings, so the source is
editable and the page can show the Cranelift IR between the Rust and the
WASM. A spike compiled NaNVM and every harness fixture that way and recorded
its costs. This design is the one to build first; that one stays an
alternative.

### Open questions

- **What "second run" means.** This design reads it as the WASM run, which
  follows the JavaScript one. If it means a warm-up run before a measured one,
  the Run button runs each route twice and reports the second.

### Tasks

- [x] Settle the entry point, and add the demo crate with its wrapper, the
      `npm run gen` step that writes the `.rs`, and the `buildText()` step
      that builds the `.wasm`.
- [x] Build the demo page: source, disassembly, Run button and stats, with
      one sample, `hello`.
- [x] Print the WAT in the deployment build.
- [ ] Report the JavaScript run's memory, where the browser measures it.
- [x] Add a sorting sample, `sort`, to compare the two routes' running time.
- [x] Add a sample that computes without allocating, `collatz`.
- [ ] Find where the WebAssembly route's time goes on `collatz`, which
      allocates nothing yet runs about fifty times slower than JavaScript.

### Related

- [WASM demo pages with rustc in the browser](./wasm-demos-in-browser-rustc.md)
  — the [alternative](#alternative), with the Weblings spike's results.
- [fjs–nanvm integration](./fjs-nanvm-integration.md) — the FJS → Rust → NaNVM
  pipeline these pages run.
- [Console program](../nanvm/lib/todo/console-program.md) — the console effect
  on the native side.
- [Compiler output demos](../fjs/compiler/todo/output-demos.md) — the existing
  pages that show the generated Rust as text.
- [Bytecode to WebAssembly](../nanvm/lib/todo/056-bytecode-to-wasm.md) — a
  different route to WASM, by translating bytecode, not by building Rust.
