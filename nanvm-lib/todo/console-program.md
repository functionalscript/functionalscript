## Console program

**Priority:** P2
**Status:** open

The `nanvm` **crate** — the self-hosting milestone of the
[MVP roadmap](./mvp-roadmap.md), shipped on crates.io (not npm): the
`nanvm-lib` runtime, the generated Rust of the FJS compiler (the same single
source that ships on npm as FJS code), and a thin hand-written `main`, built
by cargo into a single native executable that parses and runs `.f.js`
directly — no Node/Deno, no rustc at the user's run time — executing code
via the interpreter behind the `Function` constructor.

The generated compiler source is **never committed to git**: it is packaged
into the `.crate` at publish time (`.gitignore`d, listed in `Cargo.toml`'s
`include` field), so consumers build pure Rust with no build dependencies —
no Node, no network, no third-party JS engine — while the repository stays
free of generated code. See the distribution section of
[mvp-roadmap](./mvp-roadmap.md) for the full arrangement, the rejected
alternatives, and the reproducibility check: both distributions must emit
byte-identical `.rs` output for the same input; once the crate ships, the
check closes into a fixed point — the crate-shipped compiler regenerates its
own packaged source, identically.

Open question (see [mvp-roadmap](./mvp-roadmap.md#open-questions)): is the
crate's binary named `fjs` (same CLI surface as the npm tool, native) or
`nanvm`?

**Execution semantics:** a module has no starting point of its own, so merely
loading it proves little. The entry point is the module's `export default`:
after parsing and compiling the module, the VM evaluates the default export,
if any; if it is a function, the VM runs it; the result is printed to stdout
as JSON.
