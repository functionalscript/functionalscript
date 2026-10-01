## Try it: link the demos under a page

**Priority:** P3
**Status:** open

### Problem

A demo is on its module's page and nowhere else. The root page — where a new
reader lands — shows the catalogue and the test suite, and a reader who wants
to see what FunctionalScript *does* has to know that `fjs/crypto/sha2` or
`fjs/compiler/edag` hold a demo and walk the tree to it. The demos are the
quickest answer the site has to "what is this?", and the page that is asked
that question most does not point at one of them.

### Proposal

**A page links the demos under it, the way it runs the proofs under it.** One
rule rather than a root special case
([Every directory gets a page](../README.md#every-directory-gets-a-page)):
every directory page whose subtree holds a demo gets a **Try it** section,
one link per demo module below it, and the root page is that page for the
whole repository. `fjs/ebnf/` then offers its four grammar diagrams, `fjs/media/`
its three formats, and the root every demo there is.

```text
FunctionalScript
▾ Try it
    crypto/sha2/            SHA-256 as you type
    compiler/edag/          An expression as the graph its compiler builds
    ebnf/lib/json/          The JSON grammar as syntax diagrams
    …
▾ Contents
    …
▸ Issues
▸ Tests
```

- **Data the build already has.** `resolveDemos` yields every demo by
  directory; the section is that map filtered to the page's subtree — the
  `subtree` filter proofs already go through. A page's own demo is excluded:
  it is drawn inline above, and a link from a page to itself is the one link
  a page does not write.
- **Named as a proof is: relative to the page, without `./`** — `crypto/sha2/`
  at `fjs/`, `fjs/crypto/sha2/` at the root — and linked root-relative to that
  directory's page (`pageHref`), where the demo is the first section.
- **Placed first, open.** Before Contents, after the page's own demo if it has
  one — the order `rootPage` in [`../module.f.mjs`](../module.f.mjs) already
  argues for: what a module does is the quickest answer to what it is.
  Omitted when empty, like every other section.
- **Path order.** The order the walk already sorts by. A curated order is a
  second list nobody would keep in step with the tree.
- **A `data-links` list**, so it gets the touch padding every list of links
  gets ([A list of links pads its links for a finger](../README.md#a-list-of-links-pads-its-links-for-a-finger-not-a-mouse)).

### Open questions

1. **Does every page get the section, or only the root?** Proposed: every
   page, as above. The root-only version is the same code with one fewer
   call, and loses `fjs/ebnf/`'s and `fjs/media/`'s lists.
2. **Does a link carry a caption, and where does it come from?** A path says
   where a demo is, not what it shows. Options:
   - **None (step 1).** The path alone. The site is already made of
     identifiers, and every demo directory is named for its module.
   - **`export const caption = '…'`** beside `demo`, read at build time from
     the token stream `browser-source` already reads `demo`'s export from —
     a string literal after `export const caption =`, structurally, not by a
     pattern over text. Cheap, but a convention the type checker cannot
     see: nothing ties it to `Demo`.
   - **A `caption` field on `Demo`** (`fjs/website/demo/types.ts`), typed and
     proof-covered, but only readable by evaluating the module — so the page
     imports every demo it lists at load time, and the root would load every
     demo's dependency graph to print one line each.
   - **The first sentence of the `@module` JSDoc.** Every demo already opens
     with one, and it reads well ("SHA-256 as you type: …") — but that prose
     is written for a reader of the source, carries Markdown links, and
     where a sentence ends is not something a token stream says.

   Proposed: ship step 1 with paths, then decide between the second and
   third with the list in front of us.
3. **Is the runner's own demo in the list?** `fjs/emergent_testing/browser`
   demonstrates the test report, not a module a reader would use. Proposed:
   yes — one rule, no exclusion list; it is still what that module does.

### Tasks

- [ ] `page/module.f.mjs`: `demoLinks` — the demos of a subtree, minus the
      page's own, as a `Try it` section; proof covers an empty subtree, a
      page's own demo excluded, and root vs. nested naming.
- [ ] `Dir` gains `demos` (the subtree's demo directories), filled in
      `toDir`; `page` and `rootPage` place the section after the page's own
      demo.
- [ ] `README.md`: a "A page links the demos under it" section; tick the
      item in [generate-website](generate-website.md).
- [ ] Captions, per open question 2 — a follow-up pull request.

### Related

- [generate-website](generate-website.md) — the umbrella list.
- [../README.md](../README.md#a-demo-shows-what-a-module-does) — the demo
  contract this builds on.
