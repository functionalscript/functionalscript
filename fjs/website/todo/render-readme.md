## Render `README.md` files on the site

**Priority:** P3
**Status:** open

### Problem

A directory's page lists its `README.md` as a file link and nothing more. The
root page is the clearest case: the repository's own `README.md` says what
FunctionalScript is, how to install it and how to compile a module, and the
site's front page shows none of it — a visitor sees `Cargo.lock` and
`bun.lock` before they learn what the language is. GitHub renders that README
on the repository's front page; the site sends the reader there to read it
([`../README.md`](../README.md#a-file-opens-on-github-at-the-commit-the-site-was-built-from)).

The same holds one level down: most module directories carry a README that
explains the module, and its page shows the file name.

### Why the Markdown reader the site already has does not cover it

[`media/markdown`](../../media/markdown/module.f.mjs), over the grammar
[`ebnf/lib/markdown`](../../ebnf/lib/markdown/module.f.mjs), reads a
**release file**: a flat list of `- ` entries whose spans are text, code,
bold, italic and links. Its types say what it cannot express — headings, code
fences, numbered lists, nested lists, block quotes, tables, interior blank
lines — and its block layer, `entryTexts`, refuses any line that is neither an
entry nor a continuation of one.

The READMEs are written in exactly what it leaves out. A rough line scan of
the 77 tracked `README.md` files at `ad16927` — a pattern count for sizing
the work, not a parse, so the numbers are approximate:

| construct | READMEs |
| --- | --- |
| headings | 77 |
| relative links | 61 |
| tables | 48 |
| a link inside bold | ~48 |
| fenced code blocks | 46 |
| numbered lists | 15 |
| nested lists | 10 |
| block quotes | 3 |
| raw HTML | 2 |
| images | 1 |

Every README has a heading, so today's reader renders none of them.

### Decisions

- **A README the reader refuses is not rendered, and its page says so.** The
  changelog's rule — refuse what GitHub would read differently, so one source
  never gets two readings
  ([commonmark-constructs](../../ebnf/lib/markdown/todo/commonmark-constructs.md))
  — holds here too. What changes is the consequence: a refused release entry
  fails the build, because its author can rewrite it; a refused README keeps
  the page and shows the file link to GitHub with the reason, because 77
  READMEs written for GitHub cannot be a red build. A rendering that differs
  from GitHub is the plausible wrong value
  [DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
  refuses; an honest "not rendered here" is not.
- **Refusing is not enough: the reader must not accept what it misreads.**
  The changelog's subset does not refuse everything GitHub reads
  differently — commonmark-constructs has a table of what it *accepts* and
  still reads differently: an autolink `<https://…>` becomes plain text,
  `_a_` stays underscores, `&amp;` stays an entity's spelling, among others.
  None of those raises an error, so the refusal above never fires and the
  page shows a dead link where GitHub shows a live one —
  [`spec/README.md`](../../../spec/README.md) has seven autolinks.

  **That table is not the whole gate, because the target is GitHub, not
  CommonMark.** GitHub renders GitHub Flavored Markdown, which adds to
  CommonMark — among other things a bare URL becomes a link, and
  [`crypto/sign/README.md`](../../crypto/sign/README.md) opens with one,
  which the subset's plain `text` rule accepts as words. The table also says
  of itself that it is open: each review has found rows it lacked. So the
  gate is not "every row of the table" but the rule behind it: **a construct
  a README uses is read as GitHub reads it, or refused.** A construct found
  to be accepted and misread — the bare URL is the first beyond the table —
  gets a row there, and no README using it renders until that row is
  closed.
- **The subset grows toward the corpus, one construct per pull request.**
  Each step turns more READMEs from refused to rendered and none renders
  anything wrong, so every step can merge on its own. The order is by how
  many READMEs a construct unblocks: headings and paragraphs, fenced code,
  tables, then lists.
- **The block layer is one reader shared with the changelog, not a second
  Markdown parser.** A release file is a README restricted to one list, so
  the changelog keeps its own check — "a release file is one flat list" —
  above a block reader that both use. Writing a README parser beside
  `media/markdown` would be the second implementation that drifts.
  `Document`'s shape changes for this; if that breaks the published API, the
  pull request that makes it explains the API change. A breaking notice is
  optional before 1.0.
- **The README is not restricted to fit the reader.** READMEs are written
  for GitHub first, and a convention for writing them to suit this site is
  the wrong direction of dependence.

### Open questions

- **Build time or browser.** [source-and-doc-view](source-and-doc-view.md)
  renders in the browser by fetching the file beside the page. A README is
  prose rather than source, and rendering it at build time would give the
  root page its text without JavaScript and to search engines. Decide when
  the first rendered README lands.
- **The prose face.** The site is set in one monospace face, and
  [`../README.md`](../README.md#one-face-the-whole-site) leaves to this issue
  whether rendered prose keeps a face of its own. Decide on the rendered page,
  not before.
- **Where a relative link goes.** A link to a directory opens that
  directory's page on the site. A link to a file — a `.md` without a
  rendered view of its own, a `module.f.mjs`, any other file — goes where
  the same file's link in a directory's catalogue goes: `fileHref` in
  [`page/module.f.mjs`](../page/module.f.mjs), GitHub at the build's commit,
  or the raw file in a local build. One rule for both, so a file never opens
  in two places depending on which page linked it; when
  [source-and-doc-view](source-and-doc-view.md) moves `fileHref` to the
  site's own view, README links move with it. Still open: a link with a
  `#fragment` needs heading ids that match GitHub's.
- **Highlighting a code fence.** Optional, and if wanted it is
  [source-and-doc-view](source-and-doc-view.md)'s tokenizer, with its
  prerequisite. A plain `<pre>` needs neither, so it does not block this.

### Tasks

- [ ] Close the "accepted and still read differently" table in
      [commonmark-constructs](../../ebnf/lib/markdown/todo/commonmark-constructs.md):
      each row read as GitHub reads it (an autolink is a link) or refused.
      Add the rows it lacks as they are found, starting with GFM's bare-URL
      autolink.
- [ ] A block reader: headings and paragraphs, the changelog's list check
      rebuilt on top of it.
- [ ] The page generator renders a directory's `README.md` above its
      catalogue when the reader accepts it, and shows the refusal beside the
      file link when it does not.
- [ ] Relative links resolved as above.
- [ ] Fenced code blocks.
- [ ] Tables.
- [ ] Numbered and nested lists.
- [ ] Links inside bold, and the other refusals in
      [commonmark-constructs](../../ebnf/lib/markdown/todo/commonmark-constructs.md)
      the READMEs need.
- [ ] Decide the prose face on the first rendered page.

### Related

- [Generate website](generate-website.md) — "Convert `README.md` files into
  HTML and publish them" is this issue.
- [`media/markdown`](../../media/markdown/module.f.mjs) and
  [`ebnf/lib/markdown`](../../ebnf/lib/markdown/module.f.mjs) — the reader
  this extends.
- [commonmark-constructs](../../ebnf/lib/markdown/todo/commonmark-constructs.md)
  — what the subset refuses or reads differently from GitHub.
- [source-and-doc-view](source-and-doc-view.md) — the sibling view for
  source files, and the tokenizer a highlighted fence would use.
