## demo-runtime-field-memory. `render` remembers focus, size and scroll with three copies of one capture-and-restore

**Priority:** P4
**Status:** open

### Problem

Re-rendering a demo must not lose what the viewer did to its controls, so
`render` in [`demo-runtime.mjs`](../demo-runtime.mjs) captures three
things before it patches and restores them after: `focused`/`refocus`,
`resized`/`resize`, `scrolled`/`rescroll`. The three pairs are one
pattern — collect the `[name]` elements that carry a value worth
keeping, patch, find each by name again, put the value back — and each
pair writes the whole of it, including the lookup:

```js
// resized
Array.from(root.querySelectorAll('[name]'))
    .filter(el => el.style.width !== '' || el.style.height !== '')
    .map(el => ({ name: el.name, width: el.style.width, height: el.style.height }))
// resize, and the same in rescroll and refocus
const next = /** @type {HTMLInputElement | null} */ (root.querySelector(`[name="${name}"]`))
if (next === null) { continue }
```

The lookup interpolates `name` into a selector without `CSS.escape`, so
a control whose name contains a quote breaks all three; one copy fixed
would leave two.

### Proposal

A `byName(root, name)` lookup, once, with `CSS.escape`, and one record per
kind of memory:

```ts
type FieldMemory<V> = {
    readonly capture: (el: HTMLElement) => V | null
    readonly restore: (el: HTMLElement, v: V) => void
}
```

`render` captures every kind over the `[name]` elements, patches, and
restores them in the order it documents today — size, then focus, then
scroll — by one fold over the three records.

### Tasks

- [ ] `byName` with `CSS.escape`; the three `FieldMemory` records;
      `render` over them.
- [ ] The demos in the browser still keep focus, size and scroll across a
      render; preview links in the PR.
