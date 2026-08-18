## 194. Design for test effects:

**Priority:** P3
**Status:** open

```ts
// Register a test with a surviving process-side framework (Node, Deno, or Bun).
type RunTest<H, O extends Operation> = (name: TestName, test: (h: H) => Effect<O, void>)
// Run a dynamically generated subtest inside a registered process-framework test.
// Node and Deno may map this to native subtests; Bun may use an inline wrapper.
type RunSubTest<H> = (h: H, name: TestName, test: () => void) => void
```

These contracts model process-side test adapters only. They must not retain or recreate a
Playwright context.

Browser proofs are executed by the shared in-browser runner described in
[browser-testing](./browser-testing.md). The optional Playwright Test adapter opens that
HTML application, forwards run configuration, and consumes its report; it does not
register FunctionalScript proof leaves or generated subtests in the Playwright Node
worker.
