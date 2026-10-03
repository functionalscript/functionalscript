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
helper just has not moved into it. The same two files set a boolean
attribute with a branch — `setState` and `markUnreported` in the browser
runner, `busy` in the demo runtime:

```js
// emergent_testing/browser setState
if (state === 'loading' || state === 'running') { runButton.setAttribute('disabled', '') }
else { runButton.removeAttribute('disabled') }
```

which is the platform's `el.toggleAttribute('disabled', force)`. Within
`startBrowserTestSources` the infrastructure-error report is built twice
and the `[data-test-summary]` text is updated at three places, one of
which already has a `say` helper for it.

### Proposal

`macrotask` moves here; the attribute branches become `toggleAttribute`;
the runner gets a local `infrastructureReport(results)` and routes its
summary updates through `say`.

### Tasks

- [ ] `macrotask` exported from `fjs/media/html/module.mjs`; both
      adapters import it.
- [ ] `toggleAttribute` at the three sites; `infrastructureReport` and
      `say` in the runner.
- [ ] The browser test page and the demos still work; preview links in
      the PR.

### Related

- [browser-test-controls](../../../emergent_testing/todo/browser-test-controls.md)
  — the runner's controls, whose `setState` is one of the sites.
