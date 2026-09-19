## dom-renderer. Two impure renderers for one `Element`, on the same page

**Priority:** P4
**Status:** open

### Problem

`fjs/media/html` owns the `Element` type and its serialization; nothing
owns the DOM direction, so two `.mjs` files on the same generated page
each grew one:

```js
// fjs/emergent_testing/browser/module.mjs, fill and toDom — attributes, text, children
const fill = (target, [, ...rest]) => { /* setAttribute, textContent, append(toDom(…)) */ return target }
const toDom = (document, element) => fill(document.createElement(element[0]), element)
// fjs/website/demo-runtime.mjs, render — the same Element, serialized and reparsed
const render = (root, view) => {
    const was = focused(root)
    root.innerHTML = view
    refocus(root, was)
}
```

`demo-runtime` routes through `innerHTML` because `toDom` is private to the
test runner, and then needs `focused`/`refocus` to survive the destruction
of the element the reader is typing into — its own doc calls that out
("without this a demo accepts exactly one character and then drops you").
`createElement` appears in one non-proof module and `innerHTML` in one
other.

### Proposal

An impure sibling, `fjs/media/html/module.mjs`, exporting `toDom(document, element)`
and `fill(target, element)` — the `module.f.mjs`/`module.mjs` pairing
`fjs/emergent_testing/browser` already uses. The test runner imports them
and drops its two; `demo-runtime`'s `render` becomes `fill(root, view)`,
which sets attributes on nodes already in the tree and replaces only text,
so the input survives a re-render and `focused`/`refocus` go.

### Tasks

- [ ] `fjs/media/html/module.mjs` with `toDom`/`fill`; both consumers
      rewritten; the browser proof passes.
- [ ] `tsc`, `fjs test`.

### Related

- [`../../../emergent_testing/todo/browser-proof-file-size.md`](../../../emergent_testing/todo/browser-proof-file-size.md) —
  argues the adapter's surface is small; this moves the part that is not
  the adapter's.
