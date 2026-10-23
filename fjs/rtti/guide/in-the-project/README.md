# In the project

**Status:** implemented

Everything the repository reads from outside, and the compiler's own
intermediate form, is declared as a schema. Each page here names the modules
that declare one group of them, says why each is open or closed, and offers
them in its demo, imported from the module that declares them.

## Pages

- [Protocols](./protocols/README.md): JSON-RPC, MCP, and the MCP tools'
  arguments
- [Media formats](./media/README.md): the `vnd.fjs.*` blobs, JSON and JSON
  Schema
- [The expression graph](./expression-graph/README.md): `edag` and its values
- [Effects](./effects/README.md): data-shaped requests and results
- [Tooling](./tooling/README.md): CI workflows, the funding manifest, and the
  GitHub responses the website reads

## Where it is implemented

In the modules each page links; the demos import the schemas from there, so a
schema shown is the one the code runs.
