## Link to page sections with URL fragments

**Priority:** P3
**Status:** open

### Problem

Readers need shareable links to Demo, Emergent Testing, and documentation
headings, including content inside collapsed sections.

The README renderer already assigns GitHub-style IDs to headings through
`anchors` in [`../readme/module.f.mjs`](../readme/module.f.mjs). The page's
Demo and Emergent Testing sections, built by `demoSection` and `testSection`
in [`../page/module.f.mjs`](../page/module.f.mjs), need stable targets too.
Emergent Testing starts collapsed, so scrolling alone does not reveal it.

### Proposal

- Give the page sections stable fragments: `#demo` and
  `#emergent-testing`. Keep documentation headings linkable before the demo.
- On initial navigation and `hashchange`, reveal the target by opening its
  enclosing `details` elements and scroll it into view. Preserve native
  fragment navigation and browser back/forward behavior. An absent target
  leaves the page usable; revealing Emergent Testing does not run tests.
- Offer accessible permalink controls beside section and documentation
  headings so readers can discover and share their URLs.
- Resolve IDs across the whole page, including collisions between README
  headings and reserved section IDs. Preserve existing documentation links
  wherever possible; specify the collision rule before implementation.
- Keep this shared across generated module pages. Coordinate `#demo` with
  [demo query links](../demo/todo/shareable-demo-queries.md), including
  scrolling after restored input changes the layout.

### Tasks

- [ ] Define stable section IDs and the collision rule, including a README
      heading named Demo or Emergent Testing and repeated headings.
- [ ] Add section targets in the page builder and permalink controls for
      section headings and the documentation headings already rendered.
- [ ] Implement shared fragment handling for initial load, hash changes,
      and history navigation, opening collapsed ancestors before scrolling.
- [ ] Verify Demo, collapsed Emergent Testing, documentation headings,
      encoded fragments, missing targets, and unique IDs with focused proofs
      and browser checks; preserve basic anchor navigation without JavaScript.
- [ ] Document the fragment contract in the website guide.

### Related

- [Share demo inputs through URL queries](../demo/todo/shareable-demo-queries.md)
  — restores inputs and links to the Demo section.
- [Unicode anchors](../readme/todo/unicode-anchors.md) — existing limits on
  GitHub-compatible documentation heading IDs.
