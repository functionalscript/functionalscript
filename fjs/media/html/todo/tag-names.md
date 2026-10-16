## Write only names a parser reads as written

**Priority:** P4
**Status:** open

### Problem

The serializer in `module.f.mjs` writes a tag or an attribute name exactly as
it is given, so a tree can be written as markup that a parser reads as
something else:

- **Case.** A parser reads a tag name ignoring ASCII case, and the serializer
  compares the exact string. `isVoidTag` and `isRawText` miss `BR` and `STYLE`:
  an uppercase `BR` gets an end tag and its children written, and a `STYLE`'s
  text is escaped as ordinary text rather than kept raw.
- **Characters.** A parser ends a tag name at whitespace, `/` or `>`, and an
  attribute name at those or `=`. `['script ', …]` is written as `<script >`,
  and an attribute name holding `><script>` opens a script element of its own.

The DOM builders in `module.mjs` behave differently from the serializer here.
`createElementNS` keeps a tag's case, so `SCRIPT` built there is an unknown
element, while `SCRIPT` serialized into a page is a script. The DOM throws on a
name holding whitespace or `>`, while the serializer writes it.

`pageRefusal` already refuses both, for a caller that writes into a page a
tree it did not author: it accepts plain names only and finds a `script` in
any case. Found in review of functionalscript/functionalscript#2982, at
`355f4ef`.

### Proposal

Make the serializer itself refuse a name that is not plain, as an unsupported
input ([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)),
with the rule `pageRefusal` uses. Then decide one spelling for a tag's case:
either fold an HTML element's tag to lowercase wherever the serializer and the
builders classify or emit it, or refuse a tag that is not lowercase. SVG has
mixed-case tags of its own (`foreignObject`), so folding applies to the HTML
namespace only.

### Related

- `pageRefusal` in [`../module.f.mjs`](../module.f.mjs): the refusal that
  already holds the rule for one caller.
