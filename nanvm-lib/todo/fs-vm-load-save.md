## FS VM load/save

**Priority:** P3
**Status:** open

Sketch / document errors, exceptions, and execution scheme. The host environment has well-defined operations:

- **Load** — takes a root module path and optional extra parameters. Load-time errors are communicated to the host. A partially successful Load result may still be useful (e.g. for language server protocol scenarios).
- **Execute** — takes the successful result of Load and optional extra parameters. Calls the default export of the root module, which produces side effects. Ends on halt (normal completion, unhandled error, or external stop).
- **Save** — takes the successful result of Load. Corresponds to code/data transformations other than execution (e.g. bundling). Partially successful Save results may be useful similarly to partially successful Load results.

Open question: does a proper FS system provide user code means to handle errors, e.g. an exception handling mechanism similar to JS's?
