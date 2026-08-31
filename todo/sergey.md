# Current priority order

Not a tracker and not a second place to write designs: every item below is a
link to the issue that owns the work, and this file only says which of them to
pick up first. The issues themselves live next to the code they describe, per
[todo/README.md](./README.md). An item here without a link is one nobody has
filed yet — file it before working on it.

1. [Run FunctionalScript proofs inside real browsers](../fjs/emergent_testing/todo/browser-testing.md)
2. [Compile modules to EDAG before loading imports](../fjs/djs/todo/compile-modules-to-edag.md)
   — the AST-to-EDAG front end, against [the EDAG spec](./edag-spec.md).
3. [BNF rule transformers: one shape per rule kind](../fjs/bnf/todo/207-bnf-semantic-actions.md)
   — the DataJS evaluation path. It already owns what used to be sketched here:
   the four transformer shapes, the map keyed by rule **value** rather than by
   name, the optional RTTI schemas, and the `fjs/bnf/ll1` metadata leaf that
   "LL1 should propagate `Meta`" asked for (its stage 1).
4. [An `index.html` for every module directory](../fjs/website/todo/directory-index-pages.md)
   — website module browsing.
5. [Decide whether the Dockerfile still earns its place](../docker/todo/retire-dockerfile.md)
