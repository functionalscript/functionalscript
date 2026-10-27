## Replace the demo publisher with FJS

**Priority:** P3
**Status:** open

### Problem

[`nanvm/demos/publish`](../../../../nanvm/demos/publish/src/main.rs)
is a Rust program that copies the demo WASM and produces each sample's WAT.
Move this workflow into an FJS script, keeping the WebAssembly processing
reusable outside the demos. The migration should land before we implement
our own binary parser.

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

### Behavior to preserve

- Copy the original WASM bytes to `nanvm/demos/wasm/nanvm_demos.wasm`.
- Write `nanvm/demos/wasm/<sample>.wat` for each listed sample, containing
  that sample's functions with readable, demangled Rust names. These are
  display fragments; they do not need to be standalone WebAssembly modules.
- Create the output directories and remove stale sample `.wat` files while
  preserving unrelated files.
- Report unreadable or invalid input and samples with no matching functions
  as failures.
- Keep the website consuming these build artifacts; publishing remains a
  separate build step.

### Related

- [WASM demos](../README.md) — current build and output contract.
- [WASM demo pages](../../../../todo/wasm-demos.md) — the existing demo plan.
