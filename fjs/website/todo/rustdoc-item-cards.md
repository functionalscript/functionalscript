## A rustdoc page shows its own card

**Priority:** P3
**Status:** blocked
**Blocked by:** [Read HTML](../../media/html/todo/read-html.md)

### Problem

A link to a page of the Rust API reference shows the root page's card: the
site's README, which says nothing of the item the page documents. The image is
in `rustdocHead` ([`../cargo-doc/module.f.mjs`](../cargo-doc/module.f.mjs)),
the fragment `cargo doc` pastes into every page's `<head>`, so it is the same
on every page.

A card of the page's own — `struct Vm` in `nanvm_lib::vm`, and the first line
of its docs — would say in the card what the link is. That text is in the page
rustdoc wrote, and reading it is HTML parsing, which the repository cannot do
yet ([read-html](../../media/html/todo/read-html.md)).

### Proposal

Every page rustdoc writes for an item gets a card of its own, made the way a
directory's is ([the website README](../README.md#a-shared-link-shows-a-card)):
a card page beside it, screenshot at build time.

- **Read the page as it is copied.** The copy already replaces the head's
  marker with the page's `og:url` (`withPageMeta`); with a reader it can take
  the page's title and the item's summary from the same bytes, and point
  `og:image` at the page's card. `og:title` comes from the same read
  ([rustdoc-page-cards](./rustdoc-page-cards.md)).
- **A card page beside each page**, from the site's own stylesheet, listed in
  `_cards.json` with the rest, so `cards.mjs` screenshots it with no change.
- **Not every page.** rustdoc's redirect pages carry no head fragment, and
  `src/` holds the source view, whose card would be a screenful of code. Which
  pages get one is part of the design.
- **The card step's cost.** A card is a headless-Chrome screenshot on every
  deploy, and rustdoc writes about four times as many pages as the site has
  cards. Measure the step before choosing every item page; the pages a link is
  likely to point at — a crate's, a module's, a type's — may be enough.

### Ideas

- **A crate's card as the fallback.** A page with no card of its own could
  show its crate's directory's card (`nanvm/lib` for `nanvm_lib`) rather than
  the root's. That needs no reader, since the crate is the page's path, and it
  was built on branch `claude/busy-tesla-zx79as-crate-cards` and set aside: only
  one of the four crates' directories, `nanvm/lib`, has a README and so a card.
  It moves rustdoc's copy after the directory pages, the only point at which
  the generator knows which directories have a card.

### Tasks

- [ ] Read a page's title and item summary as it is copied, with
      [read-html](../../media/html/todo/read-html.md).
- [ ] Write a card page for each page that gets one, and list it in
      `_cards.json`.
- [ ] Point each such page's `og:image` at its card.
- [ ] Measure the card step with them, and choose which pages get one.
