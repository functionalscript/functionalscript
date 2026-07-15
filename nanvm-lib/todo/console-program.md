## Console program

**Priority:** P1
**Status:** open

The `nanvm` executable. Part of the [MVP roadmap](./mvp-roadmap.md): the MVP
is reached when the FJS CLI parses and compiles FJS code and then runs it by
sending the serialized AST to `nanvm`, which deserializes and executes it.

A console program similar to the one in the NaNVM repo.

**Execution semantics:** an AST has no starting point of its own, so merely
loading it proves little. The entry point is the module's `export default`:
after deserializing the AST, the VM evaluates the default export, if any;
if it is a function, the VM runs it; the result is printed to stdout as JSON.
