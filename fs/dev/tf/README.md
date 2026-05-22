# Test Framework

To enable testing in your project, you can add a simple test runner file `all.tets.ts` like this:

```ts
import { run } from 'functionalscript/fs/dev/tf/all.test.js'

await run()
```

And then run it as

- `deno test --allow-env --allow-read`,
- `node --test`,
- `bun test`.

## Design: Dependency-Free Tests

Unlike most test frameworks (Jest, Mocha, Vitest, …), test files do **not** import anything from the test framework. A test is just a plain function or object — no `describe`, `it`, `expect`, or assertion library required. This means:

- Tests are **runner-agnostic**: the same test file can be run by any compatible runner without modification.
- Tests have **no framework dependency**: they remain pure FunctionalScript modules and can be imported, composed, or inspected like any other module.

## Writing Tests

A test file must be named `*.test.f.ts` (or `*.test.f.js`). Its `default` export is the test tree.

### Functions

A zero-parameter function is a test case. It passes if it returns without throwing:

```ts
export default {
    myTest: () => 42,         // passes — returns normally
    failing: () => { throw 'oops' },  // fails — throws unexpectedly
}
```

### Nested objects

Objects are traversed recursively. Each key becomes a path segment in the output:

```ts
export default {
    math: {
        add: () => 1 + 1,
        mul: () => 2 * 2,
    },
}
```

### Throw tests

A node named `throw` (or nested inside one) marks tests that are **expected to throw**. The test passes if the function throws, and fails if it returns normally:

```ts
export default {
    throw: {
        divByZero: () => { throw new Error('division by zero') },  // passes
        noThrow: () => 42,                                          // fails
    },
}
```

A function named `throw` is also recognised as a throw-test regardless of its position in the tree:

```ts
const throw = () => { throw 'expected' }
export default { b: throw }   // passes — function name triggers throw semantics
```

### Return value as sub-tree

When a non-throw test function returns an object or another function, the return value is walked as a fresh sub-tree. This allows lazy or computed test trees:

```ts
export default {
    computed: () => ({
        nested: () => 99,   // discovered and run after `computed()` returns
    }),
}
```

Only **return values** of non-throw tests are walked as sub-trees, and the `throw` flag always resets to false for the sub-tree. Thrown values are discarded and never traversed, even if they are objects containing zero-parameter functions.
