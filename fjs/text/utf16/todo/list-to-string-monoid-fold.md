## list-to-string-monoid-fold. `listToString` rebuilds the string fold `types/string` owns

**Priority:** P4
**Status:** open

### Problem

`listToString` (`fjs/text/utf16/module.f.mjs:304-306`) concatenates with a
left `reduce` over `function/operator`'s element-first `concat`:

```js
export const listToString = fn(map(String.fromCharCode))
    .map(reduce(concat)(''))
    .result
```

`fjs/types/string/module.f.mjs:44-52` exists to own `List<string> → string`,
and its own doc comment names exactly this spelling as the thing it
supersedes: string concatenation is a lawful monoid, so `concat` there is a
balanced `monoid.fold` — "unlike the element-first `concat` in
`function/operator`, which is written for `list.reduce`".
`common/monoid`'s `fold` JSDoc states why the difference matters: a left
fold over a size-growing operation is O(n²) where the balanced fold is
O(n log n). So the codebase's two string builders disagree on the
codebase's own stated rule — and `listToString` sits on the hot path of
every `utf8ToString` call, the very function
[`../../todo/utf8-to-string-cost.md`](../../todo/utf8-to-string-cost.md)
measured at ~23 ms per module.

### Proposal

```js
import { concat as stringConcat } from '../../types/string/module.f.mjs'
export const listToString = compose(map(String.fromCharCode))(stringConcat)
```

No cycle: `types/string` depends only on `list`/`function*`/`common/monoid`.
The `fn`/`reduce`/operator-`concat` imports drop out.

### Tasks

- [ ] Rewrite `listToString` over `types/string`'s `concat`; drop the
      operator import.
- [ ] Re-run the `utf8-to-string-cost` measurement and record the number
      there — this may be a piece of that P2, not just a cleanup.
- [ ] `tsc`, `fjs t`.

### Related

- [../../todo/utf8-to-string-cost.md](../../todo/utf8-to-string-cost.md) —
  lists "build the string in blocks" as an undecided direction; this issue
  is that direction, already built one module away.
