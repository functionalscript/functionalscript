## Markdown inline spans become HTML nodes in two modules

**Priority:** P4
**Status:** open

### Problem

Two readers walk `fjs/media/markdown`'s `Inline` union, `text`, `code`,
`strong`, `em`, `del`, `link` and `image` in
[`types.ts`](../../media/markdown/types.ts), to `fjs/media/html` nodes:
`spanNode` in [`changelog`](../changelog/module.f.mjs) and `node` inside
`readmeNodes` in [`readme`](../readme/module.f.mjs).

```js
// changelog: spanNode
if (kind === 'code') { return ['code', span[1]] }
if (kind === 'strong') { return ['strong', ...span[1].map(spanNode)] }
if (kind === 'em') { return ['em', ...span[1].map(spanNode)] }
if (kind === 'del') { return ['del', ...span[1].map(spanNode)] }
if (kind === 'link') { return ['a', { href: span[2] }, ...span[1].map(spanNode)] }
// readme: node
if (kind === 'code') { return ok(['code', span[1]]) }
if (kind === 'strong' || kind === 'em' || kind === 'del') {
    const inner = nodes(span[1])
    return inner[0] === 'error' ? inner : ok([kind, ...inner[1]])
}
```

They differ in the link policy alone: the changelog takes the `href` as
written, the readme resolves it through `href` and refuses what it cannot
place, images included. A new span kind in `media/markdown`, which
[inline-math](../../media/markdown/todo/inline-math.md) and others there
propose, is added to two switches in two modules, and the changelog's is
exported API.

### Proposal

One reader, parameterised by what differs: `inlineNode: (link: (href:
string) => Result<string, string>) => (span: Inline) => Result<Node,
string>`, in `readme` or in a small module both import. `readmeNodes`
passes its `href`; the changelog passes `ok` and unwraps, since its spans
never fail, and drops `spanNode` from its exports.

### Tasks

- [ ] `inlineNode` with a proof over every span kind and both link
      policies.
- [ ] `readme` and `changelog` over it; `spanNode` gone.
- [ ] `tsc` and the suite under `fjs/website`.

### Related

- [render-readme](./render-readme.md) — the readme reader this is one half
  of.
