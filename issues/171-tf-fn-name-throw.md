# 171. `tf`: stop relying on JS function names to detect throw tests

**Priority:** P3
**Status:** won't fix

## Problem

`parseTestSet` in `./fs/emergent_testing/module.f.ts` checks `fn.name === 'throw'` to mark
a test as expecting a throw:

```ts
return { fn, throws: throws || fn.name === 'throw' }
```

This relies on JS engines inferring the name `'throw'` for a function defined
under a `throw` key in an object literal. V8 does this reliably, but Bun does
not — it may report a different inferred name depending on how the function is
bound or optimised. The `throwByFunctionName` test in `./fs/emergent_testing/test.f.ts` was
added as a workaround to document and guard this behaviour.

## Why `fn.name` is redundant

In the normal case — `{ throw: () => ... }` inside the test tree — both checks
fire simultaneously: the key `j === 'throw'` already sets `throws = true` before
`parseTestSet` sees the function. The `fn.name` path only differs from the key
path in one unusual pattern: a function extracted from a `throw` key and
re-placed under a *different* key, expecting the inferred name to carry the
throw semantic across. That pattern is fragile, engine-dependent, and not one
test authors should rely on.

## Solution

Remove the `fn.name === 'throw'` guard from `parseTestSet`:

```ts
// before
return { fn, throws: throws || fn.name === 'throw' }

// after
return { fn, throws }
```

The rule becomes purely structural: **a test throws iff its key in the tree
is `throw`**. No knowledge of engine inferred-name rules required.

Also remove (or simplify) the `throwByFunctionName` workaround test in
`fs/emergetn-testing/test.f.ts` that was added to guard the Bun inconsistency.

## Decision: won't fix

The canonical authoring pattern is structural: **a test is a throw-test iff its
key in the object tree is `throw`**. We use only property names to convey the
throw semantic; relying on an inferred function name is not a supported pattern.

The `fn.name === 'throw'` path in `parseTestSet` is left in place as a legacy
remnant but is documented (in the JSDoc) as engine-dependent and not to be
relied upon. No code removal is planned because the secondary check is harmless
on V8 and the structural-key rule already covers all intended use cases.

Test authors must use the `throw` key to declare throw tests — not extract and
re-bind a function and rely on the engine inferring its name.
