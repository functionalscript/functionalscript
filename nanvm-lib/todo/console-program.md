## Console program

**Priority:** P2
**Status:** open

The `nanvm` **crate** — the self-hosting milestone of the
[MVP roadmap](./mvp-roadmap.md), shipped on crates.io (not npm): the
`nanvm-lib` runtime, the **committed generated Rust** of the FJS compiler
(the same single source that ships on npm as FJS code), and a thin
hand-written `main`, built by cargo into a single native executable that
parses and runs `.f.js` directly — no Node/Deno, no rustc at the user's run
time — executing code via the interpreter behind the `Function` constructor.

The generated compiler source is checked into the repository (the classic
bootstrap arrangement, like a committed generated parser), so the crate
builds on crates.io without Node; `npm run update` regenerates it, and CI
verifies the committed output matches the FJS source. Both distributions
must emit byte-identical `.rs` output for the same input; once the crate
ships, the check closes into a fixed point: the crate-shipped compiler
regenerates its own embedded source, identically.

Open question (see [mvp-roadmap](./mvp-roadmap.md#open-questions)): is the
crate's binary named `fjs` (same CLI surface as the npm tool, native) or
`nanvm`?

**Execution semantics:** a module has no starting point of its own, so merely
loading it proves little. The entry point is the module's `export default`:
after parsing and compiling the module, the VM evaluates the default export,
if any; if it is a function, the VM runs it; the result is printed to stdout
as JSON.
