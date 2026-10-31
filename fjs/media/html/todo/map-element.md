## A tree map for `Element`

**Priority:** P4
**Status:** open

### Problem

Every consumer of `parseElement` outside `media/html` writes the same
recursion: rewrite this element's attributes from its tag and attributes,
recurse into element children, keep strings. `inactive` in
[`fjs/website/page`](../../../website/page/module.f.mjs):

```js
// inactive
const [tag, attributes, children] = parseElement(view)
…
return [tag, action ? { ...attributes, disabled: '' } : pointed ? { ...attributes, 'aria-disabled': 'true' } : attributes,
    ...children.map(child => typeof child === 'string' ? child : inactive(child))]
```

and `scopeIds`'s inner `element` in
[`fjs/website/demo/control_ids`](../../../website/demo/control_ids/module.f.mjs):

```js
// element
const [tag, attributes, children] = parseElement(value)
…
return [tag, { ...fromEntries(definedEntries(attributes).map(attribute)), ...(radio ? {…} : {}) },
    ...children.map(node => typeof node === 'string' ? node : element(node))]
```

`idsOf` in the same module is the fold over the same shape, and `pageRefusal`
in [`module.f.mjs`](../module.f.mjs) a `findMap` over it. The page builder
applies `inactive` and `scopeIds` back to back, walking the prerendered view
twice. Each walk has its own `typeof child === 'string'` guard.

### Proposal

`media/html` exports the walk once:

```ts
mapElement: (f: (tag: string, attributes: StringMap<string>) => readonly [string, StringMap<string>]) => (e: Element) => Element
foldElement: <A>(f: (acc: A, tag: string, attributes: StringMap<string>) => A) => (init: A) => (e: Element) => A
```

`inactive` and `scopeIds` become functions of one element's tag and
attributes, which is what their docs describe; `idsOf` is a `foldElement`;
`demoSection`'s two traversals can become one `mapElement` with a composed
attribute function. `pageRefusal` keeps its own void and raw-text pruning.

### Tasks

- [ ] Export `mapElement` and `foldElement`, with proofs.
- [ ] Rewrite `inactive`, `scopeIds` and `idsOf` over them.
