## The subset reads less than CommonMark, and refuses the difference

**Priority:** P3
**Status:** open

### Problem

A released file has two readers: GitHub, where every contributor sees it,
and the generated site. Where CommonMark reads more than this grammar does,
the grammar **refuses** rather than reading the delimiters as text, so one
source never gets two readings. That is the safe half of the answer, not the
whole one: a release author who writes what every other Markdown tool
accepts is told no, and the reason is this parser rather than anything about
the entry.

Four constructs, each checked against GitHub's own renderer:

| written | GitHub reads | this grammar |
| --- | --- | --- |
| `**see [details](u)**` | bold around a link | refused |
| ```x``` | one code span holding `x` | refused |
| `[**details**](u)` | a link whose words are bold | refused |
| `[x](a(b)c)` | a link to `a(b)c` | refused |

The last one is the one that would have bitten hardest if it were read as
text rather than refused: stopping the target at the first `)` gives a link
to `a(b)`, which is not a stray rendering but the **wrong address**, with
nothing on the page to say so.

None of the four appears in the tree: of its 346 emphasised spans none holds
a backtick or bracket, and no entry holds two adjacent backticks, a label
with a span opener, or a target with a parenthesis.

### Proposal

Take them in the order that a writer is likely to want them.

- **Spans inside emphasis and inside a link label.** Let `strong`, `em` and
  the label hold the `span` rule the grammar already has, minus emphasis
  itself, so the nesting is one level and the rule stays LL(1). `Inline`'s
  `strong`, `em` and the link's label then carry `readonly Inline[]` rather
  than `string`, and the fold walks them as `entry` already walks a run of
  spans.
- **A balanced destination.** CommonMark allows parentheses in a target when
  they balance. That is a counter rather than a rule an LL(1) grammar can
  hold, so it wants either a nesting depth in the reader's state above the
  grammar, as `lib/js`'s templates plan, or the angle-bracket form
  `[x](<a(b)c>)`, which needs no counting.
- **A backtick run as a delimiter.** Open with a run, close with a run of
  the same length. The length is not a fixed number, so this is the same
  shape of problem as the destination, and the same answer applies.

Emphasis inside emphasis is out of scope for all of it: CommonMark allows
it, no entry has used it, and it is what makes the rule recursive rather
than one level deep.

### Tasks

- [ ] Spans inside emphasis and link labels, with the LL(1) conflict it
      raises resolved or the shape changed until it does not
- [ ] `Inline`'s rows carry spans; the fold and every consumer follow
- [ ] A balanced destination, or the angle-bracket form instead
- [ ] A backtick run as a delimiter
- [ ] The whole corpus still parses, and each case above renders as GitHub
      renders it

### Related

- [`../module.f.mjs`](../module.f.mjs) — `emphasised`, `code` and `link`, which
  name this file
- [CommonMark](https://spec.commonmark.org/) — the readings being matched
