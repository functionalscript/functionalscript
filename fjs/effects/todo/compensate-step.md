## A named step for cleanup that keeps the original error

**Priority:** P3
**Status:** open

### Problem

Run a compensating effect on the error branch, discard its own outcome, and
re-raise the error that triggered it. That policy is spelled the same way at
four sites:

- `writeFromStream` and `writeChunks` in
  [`fjs/effects/node`](../node/module.f.mjs):
  `catchStep(writeLoop(path)(…), err => resultStep(rm(path), () => pureError(err)))`
- `writeObject` in [`fjs/cas/git`](../../cas/git/module.f.mjs):
  `catchStep(rename(tmp, path), e => resultStep(rm(tmp), () => pureError(e)))`
- `givenBack` in [`fjs/git/refstore/write`](../../git/refstore/write/module.f.mjs):
  `lock => err => resultStep(rm(lock), () => pureError(err))`, wrapped by
  `unlocked`

Each carries the same paragraph: the removal's own outcome is discarded, the
write's error is what the caller needs to hear. The [README](../README.md)
sets the bar for naming a policy — `finallyStep` "was declined while no policy
had repeated … and added once two consumers in `fjs/git/refstore` had each
written it out by hand." This one has repeated across three modules, and each
site re-derives it, where a wrong derivation would propagate the `rm`'s
failure instead of the write's.

### Proposal

The error-branch sibling of `finallyStep`, beside it in
[`module.f.mjs`](../module.f.mjs) and in the README's combinator table:

```js
/** `e`, with `cleanup` run where it fails; the cleanup's answer is discarded and `e`'s error kept. */
export const compensateStep = (e, cleanup) =>
    catchStep(e, err => resultStep(cleanup, () => pureError(err)))
```

The four sites become `compensateStep(writeLoop(path)(…), rm(path))` and the
like; `givenBack` goes. The rationale is written once, in the combinator's doc.

### Tasks

- [ ] Add `compensateStep` with its proof and README row.
- [ ] Rewrite the four sites over it.

### Related

- [`fjs/git/loose/todo/loose-object-writer`](../../git/loose/todo/loose-object-writer.md)
  — the "write exclusively, rename into place" step those sites compose this
  policy into.
