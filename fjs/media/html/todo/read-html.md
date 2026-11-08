## Read HTML

**Priority:** P3
**Status:** open

### Problem

`media/html` writes HTML and cannot read it. Every page the site builds is an
`Element` tree serialized by `element`, so the site has never needed to read
HTML. It needs to now, for HTML it did not write: rustdoc's pages, which the
website copies into `/cargo.doc/`.

- **`og:title`.** Open Graph requires it on every page, and a rustdoc page's
  title is only in its `<title>`
  ([rustdoc-page-cards](../../../website/todo/rustdoc-page-cards.md)).
- **A card for each page.** A rustdoc page shows its crate's card, because the
  copy knows the crate from the page's path. A card of the page's own — the
  item's name and the first line of its docs — needs the page's content.

A text search for `<title>` is not a substitute: it cannot tell a tag from the
same characters in a comment, a script or an attribute, and
[AGENTS.md §6](../../../../AGENTS.md#6-external-tools) rules such checks out.
Deriving the title from rustdoc's file names (`struct.Vm.html`) avoids reading
the page, but is a second implementation of rustdoc's naming that drifts when a
rustdoc release changes it.

### Proposal

A tokenizer, following the [WHATWG tokenization
algorithm](https://html.spec.whatwg.org/multipage/parsing.html#tokenization),
in `media/html`: bytes in, tokens out — start and end tags with their
attributes, text, comments and the doctype.

- **Tokens, not a tree.** Tree construction is most of the standard's parser
  (insertion modes, the adoption agency, foster parenting) and none of the
  needs above want it: the head's `<title>` is a start tag, its text and an
  end tag.
- **The states that change what a `<` means.** Text inside `<title>` and
  `<textarea>` is RCDATA, and inside `<script>` and `<style>` raw text: a `<`
  there is not a tag. A tokenizer that misses them misreads any page with a
  script, which every rustdoc page has.
- **Character references.** A title can hold `&amp;` or `&lt;`, and the
  named-reference table has over two thousand entries. Numeric references and
  a short list of named ones may be enough to start, with an unknown name kept
  as text, as the standard keeps one it does not match.
- **Streaming.** A page is read in chunks, a `Vec` each, so the tokenizer takes
  its input as a list rather than one string, and a reader that wants only the
  head can stop at `</head>`.

An established parser (`parse5`) is the alternative. It is an npm dependency,
which the repository does not take lightly, and an external tool, which needs
approval first.

### Tasks

- [ ] Tokenize tags, attributes, text, comments and the doctype, with proofs
      from the standard's examples.
- [ ] RCDATA and raw text for the elements that switch to them.
- [ ] Character references: numeric, and named where a need shows.
- [ ] Read a rustdoc page's `<title>` with it, for
      [rustdoc-page-cards](../../../website/todo/rustdoc-page-cards.md).
