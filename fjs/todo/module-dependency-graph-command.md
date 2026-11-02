## Module dependency graph CLI command

**Priority:** P3
**Status:** wip

### Problem

The [smart-build epic](./smart-build-epic.md) needs an `fjs` CLI command to
export a module dependency graph as `.data.js`. The exported graph will
support website visualization and later build-cache integration.

### Proposal

Use the generic AST and dependency extraction to build a module dependency
DAG for FJS and the supported subsets of JavaScript and TypeScript. Forming a
source AST must not require admission or lowering into FAST or EDAG.

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

The initial command is `fjs deps`, with no arguments. It recursively checks
source AST formation only for files named exactly `module.f.js` or
`module.f.mjs` under the caller's directory, preparing coverage checks for
those modules.
It reports the files the current tokenizer and syntax parser cannot handle;
extending the parser is a separate step.
Arguments, dependency extraction and the graph output destination are later
steps. Website rendering and build-cache integration are tracked separately
in the epic.

### Constructor-expression syntax

The constructor syntax increment retains `new Callee(arguments)` as a distinct AST
node, with its constructor expression, ordered arguments (including spreads)
and original `new` token. Member access, grouping, nested construction and
following calls keep JavaScript's precedence. Standalone expressions beginning
with `new` retain that syntax in module, function and loop statement positions.
This increment requires the
argument parentheses; omitted argument lists, `new.target` and optional-chain
constructor targets remain separate syntax work.

This lets dependency analysis read modules using `new Map(...)`, `new Set(...)`
and `new Error(...)` without executing or resolving those constructors. The
cost is another syntax node and precedence rules to prove. FunctionalScript
admission still explicitly refuses construction at `new`; constructor behavior,
mutability, FAST and EDAG remain outside this increment.

The language designer `sergey-shandar` requested this syntax-only implementation
in the [working session](https://chatgpt.com/local/01a1908b-f970-713f-b7cb-e16f7ffb2006).
This records no approval of FunctionalScript constructor semantics.

### Tasks

- [ ] First priority: make coverage tests run only on `module.f.js` and `module.f.mjs` files.
  - [x] Add `fjs deps` to report AST parsing failures for `module.f.js` and
        `module.f.mjs` files using the current parser.
  - [ ] Ensure a generic AST can be formed for every `.f.mjs` file in the repository,
        including files the current compiler cannot parse or lower into FAST or EDAG.
    - [x] Parse braced declaration `for…of` loops as syntax, while retaining FJS
          compilation refusal; tracked in [remaining for forms](../../spec/todo/3270-for.md#generic-forof-syntax).
    - [x] Parse defaults inside object and array binding patterns; tracked in
          [default parameters and patterns](../../spec/todo/3125-default-parameters.md).
    - [x] Parse the bounded [constructor-expression syntax](#constructor-expression-syntax)
          while retaining explicit FunctionalScript refusal.
- [ ] Define the command interface and input/output behavior.
- [ ] Connect the command to AST-based dependency extraction and graph construction.
- [ ] Emit the module-to-dependencies record as `.data.js`.
- [ ] Reject cyclic module dependencies with a diagnostic.
- [ ] Add command documentation and proofs for output, shared dependencies and cycle rejection.

### Related

- [Smart build epic](./smart-build-epic.md) — foundation tasks and consumers.
- [DataJS](../../spec/datajs/README.md) — output data format.
