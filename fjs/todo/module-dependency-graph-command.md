## Module dependency graph CLI command

**Priority:** P3
**Status:** open

### Problem

The [smart-build epic](./smart-build-epic.md) needs an `fjs` CLI command to
export a module dependency graph as `.data.js`. The exported graph will
support website visualization and later build-cache integration.

### Proposal

Use the generic AST and dependency extraction to build a module dependency
DAG for FJS and the supported subsets of JavaScript and TypeScript. Parsing a
module must not require that it can be compiled into EDAG.

Write the graph as `.data.js`, preserving shared dependency nodes. Reject
module dependency cycles, including cycles permitted by JavaScript and
TypeScript, with a clear diagnostic.

The command name, arguments, input selection, output destination and exact
graph schema remain to be designed. Website rendering and build-cache
integration are tracked separately in the epic.

### Tasks

- [ ] Define the command interface and input/output behavior.
- [ ] Connect the command to AST-based dependency extraction and graph construction.
- [ ] Emit `.data.js` while preserving shared dependencies.
- [ ] Reject cyclic module dependencies with a diagnostic.
- [ ] Add command documentation and proofs for output, sharing and cycle rejection.

### Related

- [Smart build epic](./smart-build-epic.md) — foundation tasks and consumers.
- [DataJS](../../spec/datajs/README.md) — output data format.
