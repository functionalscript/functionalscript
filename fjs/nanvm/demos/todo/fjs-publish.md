## Replace the demo publisher with FJS

**Priority:** P3
**Status:** wip

### Problem

[`nanvm/demos/publish`](../../../../nanvm/demos/publish/src/main.rs)
is a Rust program that copies the demo WASM and produces each sample's WAT.
Create reusable FJS tools for parsing binary WebAssembly and writing both
binary WASM and WAT first, then use them to replace the publisher with an
FJS implementation.

### Tasks

Complete the steps in order.

#### Step 1: WASM parser and WASM/WAT writers

- [ ] Define a reusable WebAssembly AST and implement an FJS parser from
      binary `.wasm` bytes to that AST.
- [ ] Implement an FJS writer from the AST to binary `.wasm` bytes.
- [ ] Implement an FJS writer from the same AST to `.wat` text. Keep the
      parser and both writers separate and reusable, with no dependency
      on the demo publisher.
- [ ] Support the module structure needed by the demo modules, including
      imported and defined functions and their name metadata.
- [ ] Verify that binary parser/writer round trips preserve the represented
      module, and check WAT output using focused fixtures and the generated
      demo modules.

#### Step 2: Replace the demo publisher with FJS

- [ ] Replace `nanvm/demos/publish` with an FJS implementation using the
      existing effects interface for files and the reusable WASM modules
      where needed.
- [ ] Use the AST to select each sample's functions and reuse the WAT writer
      from step 1 to render them with readable, demangled Rust names.
- [ ] Update the [build-script generator](../module.f.mjs) to invoke the FJS
      implementation and regenerate its output.
- [ ] Verify the demo outputs and failure behavior, then remove the replaced
      Rust publisher crate, its workspace entry, and dependencies no longer
      used by the workspace.

### Proposal

Measured on the module the pinned Rust (1.99.1) builds today: 1,007,871
bytes, 1,079 functions, no imports, the `name`, `producers` and
`target_features` custom sections, and 130 instruction kinds, all from the
WebAssembly 2.0 core set without SIMD (sign extension, saturating
truncation and bulk memory among them). Every Rust function name is in v0
mangling (`_R…`); none is legacy (`_ZN…`).

**Modules.** Three format modules and one Rust one, none importing the
publisher:

- `fjs/media/wasm/types.ts`: the AST. A module is its sections as values,
  each in the binary's terms: types, imports, function type indices,
  tables, memories, globals, exports, start, elements, data count, code
  and data. A function body is its locals and a flat instruction list, in
  binary order, `block`/`loop`/`if` closed by an `end` of their own, so the
  three modules walk it without rebuilding a tree. The `name` section is
  parsed into its subsections; any other custom section keeps its bytes
  and its place after the section it followed.
- `fjs/media/wasm/instruction`: the one opcode table the other three read,
  each opcode with its mnemonic and immediate kind.
- `fjs/media/wasm/binary/parse` and `fjs/media/wasm/binary/write`: bytes to
  the AST, as a `Result` naming the offset of what it refuses, and back.
  Bytes are a `readonly number[]`, not a `Vec`, since a `Vec` holds 128 KiB
  and the demo module is a megabyte.
- `fjs/media/wasm/wat`: the AST to WAT, a whole module or one function.
- `fjs/rust/demangle`: v0 symbols to Rust paths, printed as
  `rustc-demangle`'s `{:#}` prints them, without crate hashes. This is a
  step the list above did not name: the Rust publisher had the
  `rustc-demangle` crate for it.

**Round trip.** `parse(write(parse(bytes)))` equals `parse(bytes)`, and
the writer is deterministic; the bytes themselves need not survive, since
`wasm-ld` writes padded LEB128 the writer does not reproduce.

**Refusals.** An opcode outside the table (SIMD, threads, GC), a malformed
section, a truncated input, or trailing bytes is an error naming its byte
offset, never a skipped instruction.

**The WAT matches `wasmprinter`'s, line for line, for every demo
sample**: the flat instruction layout, `$name` or `$"quoted name"`, the
`(;N;)` index comments, `#funcN` before a name more than one function
shares, and floats as hexadecimal with the decimal in a comment. So the
pages do not change, and the check for step 2 is a diff of the 37 samples'
WAT against the Rust publisher's, before the crate is removed.

**The publisher** is `fjs/nanvm/demos/publish/module.f.mjs`, a
`NodeProgram` run by `gen.build.sh` as
`node ./fjs/module.mjs r ./fjs/nanvm/demos/publish/module.f.mjs <same arguments>`.
It reads the module with `readWhole`, writes the same chunks back with
`writeChunks`, parses them, demangles the function names, keeps the
functions whose name contains `nanvm_demos::samples::<sample>::`, and
writes their WAT with `writeFiles`, then removes stale `.wat` files.

**Pull requests**, stacked: the opcode table, AST, parser and binary
writer; then the WAT writer and the demangler; then the publisher, the
script, and the crate's removal.

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
