## Visited links keep the link colour

**Priority:** P3
**Status:** open

### Problem

The stylesheet in `fjs/website/style/module.f.mjs` names no `a` rule at all —
at `a735da3d` its selectors are `:root`, `body`, the report's `data-*` hooks,
the controls given `font: inherit`, and `[data-section]`. So every link on the
site
takes the browser's own colours: one for a link, another for a link this reader
has opened.

Nearly every word on this site is a link. A page is a breadcrumb, a list of
files, a list of subdirectories and a list of issues, and the reader's way
through the tree is to open them. A list therefore turns two-toned as it is
used, and what the second colour says is only *where this reader has been* —
nothing about the file it names, and nothing the catalogue is for. Two readers
see two different pages, and one reader sees a page that changes under them.

It is also the one colour on the page that the site does not own. `:root`
names the background, the text, the muted text, the border and the pass/fail
pair, in a light and a dark block; the link colours come from the user agent
and are adjusted by it, so a scheme the site defines does not reach them.

### Proposal

Colour `a` from the palette and give `a:visited` the same value, so a link
looks like a link whether or not it has been followed:

```css
a, a:visited { color: var(--link) }
```

The token is defined per scheme beside `--text` and `--muted`;
[green-link-colour](green-link-colour.md) is what it holds. Both are one rule
in one file, so they can land together.

What this gives up is the visited distinction itself, which is worth naming:
it helps a reader working through a long list of references, deciding what is
left to read. These lists are not that — they are a directory's contents,
navigated by structure, and a reader returns to a page to go somewhere else
from it rather than to avoid re-reading it. The underline stays, so nothing
about *being* a link depends on the colour.

### Tasks

- [ ] Add the rule to `fjs/website/style/module.f.mjs`, with the reason beside
      it as the other rules carry theirs.
- [ ] Follow a link and come back, in both colour schemes, and check the
      breadcrumb and the lists against a page opened fresh.

### Related

- [green-link-colour](green-link-colour.md) — the value `--link` holds; the
  same rule, and the same change.
- [`../README.md`](../README.md) — "One face, the whole site": the same
  argument, made for type.
- [Generate website](generate-website.md) — the umbrella list.
