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
and drops its two; `demo-runtime`'s `render` builds the view's node with
`toDom` and swaps it in with `replaceChildren`, instead of serializing to
a string and letting the browser parse it back.

What this does **not** buy is the focus problem. `fill` is not a
reconciler: it assigns `textContent`, which drops every existing child,
and appends freshly built descendants, so a re-render through it destroys
the input being typed into exactly as `innerHTML` does. `focused` and
`refocus` therefore stay, wrapped around the new `render` as they are
around the old one. Making `fill` update matching nodes in place — same
tag at the same position keeps its node and has its attributes and text
reset — would retire them, and is a separate change to weigh on its own:
it is a small reconciler, and the test runner's rows do not need one.

### Tasks

- [ ] `fjs/media/html/module.mjs` with `toDom`/`fill`; both consumers
      rewritten; the browser proof passes.
- [ ] `tsc`, `fjs test`.

### Related

- [`../../../emergent_testing/todo/browser-proof-file-size.md`](../../../emergent_testing/todo/browser-proof-file-size.md) —
  argues the adapter's surface is small; this moves the part that is not
  the adapter's.
