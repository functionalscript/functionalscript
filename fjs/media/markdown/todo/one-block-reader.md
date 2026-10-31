## The changelog reader is a second block layer beside `readBlocks`

**Priority:** P3
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) holds two block readers for a `- ` list.
`entryTexts`, which `tryParse` runs for a release file, is a hand loop over
lines: `line.startsWith('- ')` opens an entry, a line starting with two
spaces continues it, blank lines and nested markers are refused. `readBlocks`,
which `tryParseBlocks` runs for a README, does the same work in its list arm:
`listMarker`, the indent width, the body re-read as blocks, and a paragraph
arm that joins wrapped lines with one space — the rule the module comment
argues for.

[render-readme](../../../website/todo/render-readme.md) decided this already:
"the block layer is one reader shared with the changelog, not a second
Markdown parser … the changelog keeps its own check — 'a release file is one
flat list' — above a block reader that both use." Its tasks shipped the README
side and left `entryTexts` standing, so the code contradicts the recorded
design.

The two readers have drifted. At `ad3fb2dc`, running both over every file in
`changelog/` and constraining `tryParseBlocks` to one tight list of
single-paragraph items gives the same entries for all but three files: one
empty release, one entry with two spaces after its dash (which `entryTexts`
handles with a `contentIndent` special case and `readBlocks` refuses), and one
whose continuation line begins with `>` — `readBlocks` reads that as a block
quote, as CommonMark does, while `entryTexts` joins it silently, so the
changelog page shows a reading GitHub does not
([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).

Also here: the private `arr`, `node => unmapped(node)`, is `items` exported by
[`fjs/ebnf/ast`](../../../ebnf/ast/module.f.js).

### Proposal

`tryParse` is `tryParseBlocks` plus the one check: an empty document is no
entries; one tight `list` whose every item is a single `paragraph` without an
image is the entries; anything else is refused as "a release file is one flat
list of entries". Marker padding (`-  text`) is either admitted by
`listMarker`, as CommonMark admits one to four spaces, or the one release file
loses its extra space. `parseInline(images)` keeps one caller. Error messages
move from `entry N:` to the line the block reader names; the proof's
`startsWith('entry 1:')` assertions and the website's `changelog/<v>.md:`
prefix follow.

### Tasks

- [ ] Write `tryParse` over `tryParseBlocks`; delete `entryTexts` and the
      separate image gate in `tryParseEntry`.
- [ ] Decide marker padding: admit it in `listMarker` or fix the release file.
- [ ] Import `items` from `ebnf/ast` in place of `arr`.
- [ ] Reduce the module header's "block layer" paragraph to one sentence.

### Related

- [render-readme](../../../website/todo/render-readme.md) — the decision this
  issue carries out.
