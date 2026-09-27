## FS VM load/save

**Priority:** P3
**Status:** open

Sketch / document errors, exceptions, and execution scheme. The host environment has well-defined operations:

- **Load** — takes a root module path and optional extra parameters. The FJS pipeline reads, parses and links the module graph. When evaluated, a module returns its complete export object without automatically calling any exported function. Load-time errors are communicated to the caller. A partially successful Load result may still be useful (e.g. for language server protocol scenarios).
- **Execute** — takes the successful result of Load, a caller-supplied export selection and optional invocation parameters. The consumer explicitly invokes the selected export; its effect runner performs any returned effects. Ends on halt (normal completion, unhandled error, or external stop).
- **Save** — takes the successful result of Load. Corresponds to code/data transformations other than execution (e.g. bundling). Partially successful Save results may be useful similarly to partially successful Load results.

Use `sandbox` to capture a computation's value or language throw through the
existing result/duration contract. This does not add FJS `try`/`catch` or promise
resource isolation. The [FJS loader](../../fjs/fsc/todo/load-modules-without-import-effect.md)
and [native effect runner](../../todo/nanvm-effects-node.md) own the concrete
loading and error-capture work.

The native CLI is a consumer of this execution contract. Its entry-selection
policy remains open: mirror `fjs run` by selecting `main`, select and call
`default`, or offer both; see [console-program](./console-program.md). That
policy determines the selection the CLI supplies to Execute. The generic
Execute step does not choose a fixed export name.
