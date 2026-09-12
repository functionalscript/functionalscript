## Source and documentation view on a module page

**Priority:** P3
**Status:** open
**Blocked by:**
[single-quote-and-template-lexing](../../ebnf/lib/js/todo/single-quote-and-template-lexing.md),
the grammar's issue: the JS token grammar has to recognise the spellings the
repository is written in before a view can show them. It waits on nothing
else — the grammar has no JSON consumer to regress, which is what used to
chain this issue behind the JSON tokenizer's rebuild.

### Problem

A module page that links to `module.f.mjs` sends the reader to raw text, and a
reader who wants the module's documentation has nothing to read at all. The
JSDoc is in the source; the source is on the site; nothing turns either into a
page.

### Decisions

- **Rendered in the browser, not at build time.** The repository folder is
  served, so `./module.f.mjs` is a URL from the page. A shared script fetches
  it and renders it; the generator emits nothing but the hook. Build-time
  rendering would buy pages that work without JavaScript, and no such audience
  exists — the proof runner and demos already need it. It would also cost the
  generator a read and a tokenization per module on top of the 42 s it already
  spends, for output that is stale the moment a module changes.
- **One tokenization serves both views.** The source view and the doc view are
  two renderings of the same token list, read from the JS token grammar
  [`fjs/ebnf/lib/js`](../../ebnf/lib/js/module.f.mjs) the way the compiler's
  [`fjs/fsc/tokenizer`](../../fsc/tokenizer/module.f.mjs) reads it: comments
  and trivia are tokens, every token knows where it begins and ends, and it is
  authored FunctionalScript, so it loads in a browser like any other module.
  Nothing is written twice. The token stream is
  [`fjs/js/tokenizer`](../../js/tokenizer/module.f.mjs)'s — the grammar's
  general JS stream, which the compiler's tokenizer folds — since stage 7
  of the plan replaced the hand-written scanner behind that path.
- **The grammar must first recognise the sources it will show.** Today its
  string rule is JSON's, the double quote only, and it has no template
  literal: `const a = 'x'` and a template literal alike stop the grammar at
  an `invalid token`. Nearly every authored module uses single quotes, so the
  views would show nothing or highlight garbage, and the doc extractor would
  read string contents as declarations. Widening the grammar is the
  prerequisite, as a PR of its own in `fjs/ebnf/lib/js`, tracked as
  [single-quote-and-template-lexing](../../ebnf/lib/js/todo/single-quote-and-template-lexing.md).
  A second lexer, or widening the hand-written scanner instead, is the
  "written twice" the bullet above rejects.
- **The doc extractor is ours, not `deno doc`.** `deno doc --html` produces one
  site with its own navigation and styling; slicing it per page means
  post-processing its HTML, which is more machinery than the extractor. It is
  also an external tool in the generator, which
  [`AGENTS.md` §6](../../../AGENTS.md#6-external-tools) requires approval for.
  [publish-deno-doc-to-website](publish-deno-doc-to-website.md) is a separate
  question — a full type reference — and stays open on its own.
- **The extractor's scope is what the tokens give.** The leading `@module`
  block, then one entry per `export const <name>` with the JSDoc block
  immediately before it and its `@type` line verbatim. No type resolution, no
  following of `@import`, no cross-page `{@link}`. `types.ts` is TypeScript,
  out of the tokenizer's reach, and appears as a file link only.

### Proposal

- `fjs/website/source-view.mjs` — the thin impure boundary: fetch the path
  named by a `data-source` attribute, hand the text to the pure module below,
  insert the result.
- `fjs/website/source-view/module.f.mjs` — pure: `(source: string) => Node`
  for the highlighted source, and `(source: string) => Node` for the docs,
  both built from one `tokenize` call and rendered with
  [`media/html`](../../media/html/module.f.mjs). Its `proof.f.mjs` covers a
  module with a `@module` block, an export with JSDoc, an export without, and a
  comment that is not JSDoc.
- The page emits `<pre data-source="./module.f.mjs">`, a `<section
  data-doc="./module.f.mjs">`, and one `<script type="module">` for the runner.
- Highlighting classes are named by token kind (`keyword`, `string`,
  `comment`, …) and coloured in [`_main.css`](../style/module.f.mjs).

### Tasks

- [ ] Prerequisite:
      [single-quote-and-template-lexing](../../ebnf/lib/js/todo/single-quote-and-template-lexing.md),
      before anything below. It is larger than this issue first assumed: a
      template cannot be one opaque token, because substitutions in this
      repository nest.
- [ ] Confirm the tokenizer module links in a browser, i.e. that its own page
      lists it as a proof rather than as one with a blocker.
- [ ] `source-view/module.f.mjs`: tokens → highlighted `<pre>` content.
- [ ] `source-view/module.f.mjs`: tokens → doc entries (`@module` block, one
      entry per `export const`).
- [ ] `source-view.mjs`: fetch and insert, one script for both views.
- [ ] Emit the hooks from the page generator.
- [ ] Measure tokenization time in the browser on the largest module; record
      the number in this file's replacement (a README or JSDoc) if it matters.

### Related

- [`fjs/website`](../README.md) — the pages this renders into, and the
  serving model that lets one fetch its own source.
- [Publish `deno doc` to website](publish-deno-doc-to-website.md) — the full
  type reference, deliberately not this.
- [Generate website](generate-website.md) — "Source code highlighting" is this issue.
- [`fjs/js/tokenizer`](../../js/tokenizer/module.f.mjs) — the token stream
  both views read, over the grammar [`fjs/ebnf/lib/js`](../../ebnf/lib/js/module.f.mjs).
- [single-quote-and-template-lexing](../../ebnf/lib/js/todo/single-quote-and-template-lexing.md)
  — the prerequisite, as its own issue.
