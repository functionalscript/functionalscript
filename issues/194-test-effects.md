# 194. Design for test effects:

**Priority:** P3
**Status:** open

```ts
// Register the test for external test-frameworks (Node, Deno)
type RunTest<H, O extends Operation> = (name: TestName, test: (h: H) => Effect<O, void>)
// Register the test for Node, Deno and run the test for Bun and Playwright
type RunSubTest<H> = (h: H, name: TestName, test: () => void) => void
```
