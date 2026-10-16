## Read tag names ignoring case

**Priority:** P4
**Status:** open

### Problem

An HTML parser reads a tag name ignoring ASCII case. The serializer in
`module.f.mjs` compares the exact string instead, so an element tree with an
uppercase tag is written as something other than what the same lowercase tree
is written as:

- `isVoidTag` and `isRawText` miss `BR` and `STYLE`. An uppercase `BR` gets an
  end tag and its children written out, and a `STYLE`'s text is escaped as
  ordinary text rather than kept raw.
- The DOM builders in `module.mjs` keep the case too: `createElementNS` in the
  HTML namespace does not fold it, so `SCRIPT` built there is an unknown
  element, while `SCRIPT` serialized into a page is a script.

The same tree therefore means different things depending on whether it is
serialized or built. `holdsScript` already refuses a `script` in any case,
because that is the one difference that runs code. Found in review of
functionalscript/functionalscript#2982, at `585a16a`.

### Proposal

Decide one spelling for a tag. Either fold an HTML element's tag to lowercase
wherever the serializer and the builders classify or emit it, or refuse a tag
that is not lowercase, as an unsupported input
([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
SVG has mixed-case tags of its own (`foreignObject`), so folding applies to the
HTML namespace only.

### Related

- `holdsScript` in [`../module.f.mjs`](../module.f.mjs): the refusal that
  already reads a tag in any case.
