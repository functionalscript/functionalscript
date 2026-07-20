## Console program

**Priority:** P2
**Status:** open

The `nanvm` executable — the self-hosting milestone of the
[MVP roadmap](./mvp-roadmap.md): the FJS compiler, compiled to Rust by the
code generator, is embedded into a single native executable that parses and
runs `.f.js` directly — no Node/Deno, no interprocess handoff — executing
code via the interpreter behind the `Function` constructor.

A console program similar to the one in the NaNVM repo.

**Execution semantics:** a module has no starting point of its own, so merely
loading it proves little. The entry point is the module's `export default`:
after parsing and compiling the module, the VM evaluates the default export,
if any; if it is a function, the VM runs it; the result is printed to stdout
as JSON.
