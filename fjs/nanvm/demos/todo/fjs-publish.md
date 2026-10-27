## Replace the demo publisher with FJS

**Priority:** P3
**Status:** open

### Problem

[`nanvm/demos/publish`](../../../../nanvm/demos/publish/src/main.rs)
is a Rust program that copies the demo WASM and produces each sample's WAT.
Move this workflow into an FJS script, keeping the WebAssembly processing
reusable outside the demos. The migration should land before we implement
our own binary parser. Once that parser and its AST-based WAT serializer
are available, the browser demo should generate the WAT it displays.

### Tasks

Complete the stages in order.

#### Stage 1: FJS script using wasm-tools

- [ ] Replace the Rust publisher with an FJS script using the existing effects
      interface for files and subprocesses, and
      [`wasm-tools`](https://github.com/bytecodealliance/wasm-tools) for
      WebAssembly processing, including demangling and WAT output.
- [ ] Preserve per-sample function selection: printing the entire module with
      `wasm-tools print` alone does not replace the current publisher.
- [ ] Update the [build-script generator](../module.f.mjs) to invoke the FJS
      script, regenerate its output, and make `wasm-tools` available in the
      local and deployment build environments.
- [ ] Verify the demo outputs and failure behavior, then remove the replaced
      Rust publisher crate, its workspace entry, and dependencies no longer
      used by the workspace.

#### Stage 2: FJS WASM parser and AST

- [ ] Implement a reusable FJS parser that reads binary `.wasm` bytes and
      produces a WebAssembly AST. This is a binary parser, not a parser of
      the WAT text printed in stage 1.
- [ ] Keep binary parsing, sample selection, and WAT serialization separate.
      Represent the structure needed to inspect functions and their names,
      including the relationship between imported and defined functions.
- [ ] Use the AST for the publisher's sample selection and WAT generation,
      replacing its `wasm-tools` processing as the FJS implementation covers
      the demo modules.
- [ ] Prove the parser and publisher behavior with focused fixtures and the
      generated demo modules, using `wasm-tools` as a reference during the
      transition.

#### Stage 3: Generate WAT directly in the demo

- [ ] Reuse the FJS binary parser, AST, name demangling, sample selection,
      and WAT serializer from stage 2 in the browser demo: load the `.wasm`,
      parse it, and generate and display the selected sample's WAT directly.
- [ ] Replace fetching pre-generated `.wat` files with this in-demo
      generation, then remove those files from the publishing step.
      Continue publishing the `.wasm` the demo loads.
- [ ] Verify that the displayed WAT comes from the same WASM module the demo
      executes, with the same readable names and sample filtering. Keep
      parsing and WAT generation outside timed sample execution.

### Behavior to preserve

- Copy the original WASM bytes to `nanvm/demos/wasm/nanvm_demos.wasm`.
- Show each sample's functions with readable, demangled Rust names. The WAT
  listings are display fragments; they do not need to be standalone
  WebAssembly modules.
- During stages 1 and 2, write `nanvm/demos/wasm/<sample>.wat`, create output
  directories, and remove stale sample `.wat` files while preserving
  unrelated files. Stage 3 replaces these WAT artifacts with text generated
  in the browser demo.
- Report unreadable or invalid input and samples with no matching functions
  as failures.
- Keep compiling and publishing the WASM binary as a separate build step;
  stage 3 moves WAT generation into the demo.

### Related

- [WASM demos](../README.md) — current build and output contract.
- [WASM demo pages](../../../../todo/wasm-demos.md) — the existing demo plan.
