## Replace the demo publisher with FJS

**Priority:** P3
**Status:** open

### Problem

[`nanvm/demos/publish`](../../../../nanvm/demos/publish/src/main.rs)
is a Rust program that copies the demo WASM and produces each sample's WAT.
Create reusable FJS tools for parsing and writing binary WebAssembly first,
then use them to replace the publisher with an FJS implementation.

### Tasks

Complete the steps in order.

#### Step 1: Parse and write WASM files

- [ ] Define a reusable WebAssembly AST and implement an FJS parser from
      binary `.wasm` bytes to that AST.
- [ ] Implement the corresponding FJS writer from the AST to binary
      `.wasm` bytes. Keep parsing and writing separate, with no dependency
      on the demo publisher.
- [ ] Support the module structure needed by the demo modules, including
      imported and defined functions and their name metadata.
- [ ] Verify that parser/writer round trips preserve the represented module,
      using focused fixtures and the generated demo modules.

#### Step 2: Replace the demo publisher with FJS

- [ ] Replace `nanvm/demos/publish` with an FJS implementation using the
      existing effects interface for files and the reusable WASM modules
      where needed.
- [ ] Use the AST to select each sample's functions and generate its WAT
      with readable, demangled Rust names. Keep this WAT text serializer
      separate from the binary `.wasm` writer.
- [ ] Update the [build-script generator](../module.f.mjs) to invoke the FJS
      implementation and regenerate its output.
- [ ] Verify the demo outputs and failure behavior, then remove the replaced
      Rust publisher crate, its workspace entry, and dependencies no longer
      used by the workspace.

### Behavior to preserve

- Copy the original WASM bytes to `nanvm/demos/wasm/nanvm_demos.wasm`.
  The publisher need not rewrite the binary through the new writer.
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
