## One walk over `BindingEvent`

**Priority:** P4
**Status:** open

### Problem

`BindingEvent` in [`types.ts`](../types.ts) is a three-variant tree: a
`function` holds a child scope's events, a `region` holds nested events,
and everything else is a leaf. [`module.f.mjs`](../module.f.mjs) owns the
type and walks it once, in `analyzeBindings`; [`sugar`](../sugar/module.f.mjs)
walks it twice more, in `scopesOf` and `eventFacts`, and the three preorder
loops differ only in what they collect:

```js
// sugar: eventFacts
const [event, ...rest] = pending
if (event[0] === 'function') { pending = [...event[1].events, ...rest]; continue }
if (event[0] === 'region') { pending = [...event[1], ...rest]; continue }
// sugar: scopesOf
if (event[0] === 'function') { scopes = [...scopes, event[1]]; pending = [...event[1].events, ...rest] }
else { pending = event[0] === 'region' ? [...event[1], ...rest] : rest }
```

`analyzeBindings` keeps the owning scope alongside each event through a
cons list; the two in `sugar` rebuild the work list with an array spread per
step, so a long region is walked in quadratic time, and they have no scope
to hand to a caller that would want one.

### Proposal

One fold in `module.f.mjs`, beside the type: `eventLeaves(events):
readonly { scope: FunctionTarget, event: BindingEvent }[]` in preorder, or
a `foldEvents(f, init)` that feeds the same pairs. `analyzeBindings`,
`scopesOf` and `eventFacts` become folds over it; `eventFacts`'s two
de-duplicated lists are a `Set` over the leaves.

### Tasks

- [ ] `eventLeaves` or `foldEvents` with a proof.
- [ ] The three walks over it.
- [ ] `tsc` and the suite under `fjs/js/ast`.
