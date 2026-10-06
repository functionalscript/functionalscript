## macrotask-owner. Two DOM adapters copy `macrotask` and toggle attributes by hand

**Priority:** P5
**Status:** open

### Problem

[`fjs/website/demo-runtime.mjs`](../../../website/demo-runtime.mjs) and
[`fjs/emergent_testing/browser/module.mjs`](../../../emergent_testing/browser/module.mjs)
both define, byte for byte:

```js
const macrotask = () => new Promise(resolve => { setTimeout(resolve, 0) })
```

Both already import this module's [`module.mjs`](../module.mjs) for
`patch`, `toDom` and `fill`, so the DOM adapter they share exists; the
helper just has not moved into it. The browser runner sets a boolean attribute with a branch, in `setState`
and `markUnreported`:

```js
// emergent_testing/browser setState
if (state === 'loading' || state === 'running') { runButton.setAttribute('disabled', '') }
else { runButton.removeAttribute('disabled') }
```

which is the platform's `el.toggleAttribute('disabled', force)`. The
demo runtime's `busy` has the same two-branch shape, but its attribute
carries a value: `data-demo-working` holds the wait note, which
[`fjs/website/style`](../../../website/style/module.f.mjs) renders with
`attr(data-demo-working)`. That branch is not a boolean toggle and
stays as it is. Within
`startBrowserTestSources` the infrastructure-error report is built
twice. The `[data-test-summary]` element is looked up and written in
three functions — `startBrowserTestSources`, `renderBrowserReport` and
`startBrowserTests` — and only the first wraps the write in a `say`
helper; the other two spell the lookup and the assignment again.

### Proposal

`macrotask` moves here; the runner's two boolean branches become
`toggleAttribute`, and `busy`'s value-bearing one is left alone. The
runner's proof runs under `node --test` against a stand-in element in
[`browser/proof.mjs`](../../../emergent_testing/browser/proof.mjs) that
has `setAttribute` and `removeAttribute` but no `toggleAttribute`, so
the stand-in and its type gain it in the same change, or the proof
throws before it reaches the runner;
the runner gets a local `infrastructureReport(results)` and routes its
summary updates through `say`.

### Tasks

- [ ] `macrotask` exported from `fjs/media/html/module.mjs`; both
      adapters import it.
- [ ] `toggleAttribute` in `setState` and `markUnreported`, and on
      the Node stand-in element and its type in `browser/proof.mjs`;
      `infrastructureReport` and `say` in the runner.
- [ ] The browser test page and the demos still work; preview links in
      the PR.

### Related

- [browser-test-controls](../../../emergent_testing/todo/browser-test-controls.md)
  — the runner's controls, whose `setState` is one of the sites.
