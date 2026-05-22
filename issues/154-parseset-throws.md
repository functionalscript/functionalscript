# 154. `parseTestSet`: eliminate double `sandbox` call for throw-tests

## Problem

When a test function is expected to throw (either because the enclosing tree
node is named `'throw'`, or because `throws` is already `true`), `parseTestSet`
currently returns a *wrapper* function:

```ts
return () => {
    const { result: [tag, value] } = sandbox(xt)  // inner sandbox
    if (tag === 'ok') { throw value }
    return value
}
```

The caller then runs `sandbox` on that wrapper:

```ts
const { result: [s, r], duration: delta } = sandbox(set)  // outer sandbox
```

Two problems follow:

1. **Double cost** — `sandbox` is invoked twice for every throw-test.
2. **Wrong timing** — the outer duration includes the overhead of the inner
   `sandbox` call, not just the test function itself.

## Solution

Return a *record* instead of a bare function, bundling the test function with a
boolean that declares whether a throw is expected:

```ts
export type TestEntry = {
    readonly fn: Test
    readonly throws: boolean
}
```

`parseTestSet` becomes:

```ts
// before (throws === false, name !== 'throw'):
return xt

// before (throw-test):
return () => { ... sandbox(xt) ... }

// after (both cases):
return { fn: xt, throws: throws || xt.name === 'throw' }
```

The caller runs `sandbox` exactly once and interprets the result using the flag:

```ts
const { result: [s, r], duration: delta } = sandbox(set.fn)
const passed = set.throws ? s === 'error' : s === 'ok'
```

## Distinguishing `TestEntry` from `readonly(readonly[string, unknown])[]`

The new `TestSet` union is:

```ts
export type TestSet = TestEntry | readonly(readonly[string, unknown])[]
```

`TestEntry` is a plain object; the other branch is always an array.
`Array.isArray` is the natural discriminant — no tag field needed:

```ts
if (Array.isArray(set)) {
    // tree of named children
} else {
    // TestEntry — run sandbox(set.fn) once
}
```

Previously the check was `typeof set === 'function'`; it becomes
`!Array.isArray(set)`.

## Impact

- `parseTestSet` no longer creates wrapper functions.
- The caller in `test` handles the `throws` inversion directly.
- Timing reported per test is accurate (single `sandbox` call).
- `TestSet` and `TestEntry` are the only exported type changes.
