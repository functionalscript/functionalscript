## A rustdoc page shows its crate's card

**Priority:** P3
**Status:** open

### Problem

A link to a page of the Rust API reference shows the root page's card: the
site's README, which says nothing of the crate the page documents. The image
is in `rustdocHead` ([`../cargo-doc/module.f.mjs`](../cargo-doc/module.f.mjs)),
the fragment `cargo doc` pastes into every page's `<head>`, so it is the same
on every page.

The crate already has a card of its own. A crate's directory — `nanvm/lib` for
`nanvm_lib`, by `crateOf` — is a page of the site, and a directory whose README
is rendered has a card image, `_card.png` beside its `index.html`
([the website README](../README.md#a-shared-link-shows-a-card)). That card says
what the crate is, which is what a link into its reference should say too.

### Proposal

Every page under `/cargo.doc/<crate>/` — and rustdoc's source view of it,
`/cargo.doc/src/<crate>/` — shows the card of `<crate>`'s directory, described
by that directory's page title, as the directory's own page is. A page with no
crate (rustdoc's shared assets, our index at `/cargo.doc/index.html`), or whose
crate's directory has no card, shows the root page's card, as today.

- **The card is chosen as the page is copied**, where `og:url` already is
  ([rustdoc-page-cards](./rustdoc-page-cards.md)): `withPageUrl` replaces the
  head's marker, and the replacement takes the card tags as well. The fixed
  fragment then carries no card tags, since Open Graph reads a second
  `og:image` as a second image, not as an override.
- **The generator writes the tags whatever the origin**, so a local build,
  which shows the small card and no image, still gets `og:site_name`,
  `og:type` and `twitter:card` from the marker.
- **Which directories have a card is known only once their READMEs are
  read**, in `writePages`, and rustdoc's output is copied before that, since
  the pages link the crates it documents. Either the copy moves after the
  pages, the crates being known from the walk, or the card is decided ahead of
  both. The first keeps one reader of each README.

### Tasks

- [ ] Choose a page's crate from its path under `cargo.doc/`, and the card of
      that crate's directory, falling back to the root's.
- [ ] Move the card tags from `rustdocHead` to the marker's replacement.
- [ ] Copy rustdoc's output once the directories with a card are known.
- [ ] Say in the website README which card a rustdoc page shows.
