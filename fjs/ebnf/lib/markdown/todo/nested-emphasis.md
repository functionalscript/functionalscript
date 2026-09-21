## Emphasis does not nest, where CommonMark does

**Priority:** P3
**Status:** open

### Problem

CommonMark nests inline spans inside emphasis, and GitHub renders that:

```md
- **see [details](https://example.com)** and **a `code` b**
```

```html
<li><strong>see <a href="https://example.com">details</a></strong>
    and <strong>a <code>code</code> b</strong></li>
```

This grammar's emphasis holds plain text. It **refuses** those inputs rather
than reading the delimiters as characters, because a released file has two
readers — GitHub and the generated site — and a body that swallowed them
would give one source two answers: a link on GitHub, its own brackets here.
A refusal leaves one reading and tells the author at build time.

Refusing is the safe half of the answer, not the whole one. A release author
who writes what every other Markdown tool accepts is told no, and the reason
is this parser rather than anything about the entry.

Nothing in the tree is affected: of its 346 emphasised spans, none holds a
backtick or a bracket ([`../module.f.mjs`](../module.f.mjs)'s `emphasised`).

### Proposal

Let `strong` and `em` hold spans rather than text — the `span` rule the
grammar already has, minus emphasis itself, so that the nesting is one level
and the rule stays LL(1). `Inline`'s `strong` and `em` then carry
`readonly Inline[]` instead of `string`
([`fjs/media/markdown/types.ts`](../../../../media/markdown/types.ts)), and
the fold walks them as `entry` already walks a run of spans.

Emphasis inside emphasis is a separate question and not part of this: CommonMark
allows it, no entry has ever used it, and it is what makes the rule recursive
rather than one level deep.

### Tasks

- [ ] `strong` and `em` over `span`, with the LL(1) conflict this raises
      resolved or the shape changed until it does not
- [ ] `Inline`'s two emphasis rows carry spans; the fold and every consumer
      of them follow
- [ ] Check the whole corpus still parses, and that a nested case now
      renders as GitHub renders it

### Related

- [`../module.f.mjs`](../module.f.mjs) — `emphasised`, which names this file
- [CommonMark](https://spec.commonmark.org/) — the nesting being matched
