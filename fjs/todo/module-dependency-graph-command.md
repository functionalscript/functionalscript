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

Write the graph as `.data.js`. Reject module dependency cycles, including
cycles permitted by JavaScript and TypeScript, with a clear diagnostic.

### Graph format

Represent the graph as a record mapping each module identifier to an array
of its direct dependency identifiers:

```javascript
import { array, record, string } from '../rtti/module.f.mjs'

const moduleDependencies = array(string)
const modules = record(moduleDependencies)
```

For the current implementation, record keys and dependency entries are module
paths. Include each module once, with an empty array when it has no
dependencies. Modules sharing a dependency refer to the same identifier.

In the long run, dependency relationships need module hashes rather than
module paths. Replace paths with hashes in both record keys and dependency
arrays, keeping the same graph shape. The hash definition and migration are
future work.

The command name, arguments, input selection and output destination remain
to be designed. Website rendering and build-cache integration are tracked
separately in the epic.

### Tasks

- [ ] First priority: make coverage tests run only on `module.f.js` and `module.f.mjs` files.
  - [ ] Ensure a generic AST can be formed for every `.f.mjs` file in the repository,
        including files the current compiler cannot parse or compile into EDAG.
- [ ] Define the command interface and input/output behavior.
- [ ] Connect the command to AST-based dependency extraction and graph construction.
- [ ] Emit the module-to-dependencies record as `.data.js`.
- [ ] Reject cyclic module dependencies with a diagnostic.
- [ ] Add command documentation and proofs for output, shared dependencies and cycle rejection.

### Related

- [Smart build epic](./smart-build-epic.md) — foundation tasks and consumers.
- [DataJS](../../spec/datajs/README.md) — output data format.
