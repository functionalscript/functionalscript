## The subset reads less than CommonMark, and refuses only some of the difference

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

Twelve constructs so far, each checked against GitHub's own renderer rather
than argued from the spec:

| written | GitHub reads | this subset |
| --- | --- | --- |
| `**see [details](u)**` | bold around a link | refused |
| `[**details**](u)` | a link whose words are bold | refused |
| a two-backtick code span | one code span holding `x` | refused |
| a code span padded with spaces | `code` — one stripped each side | refused |
| `a * b * c` | three words and two asterisks | refused |
| `[x](a(b)c)` | a link to `a(b)c` | refused |
| `[x](u "t")` | a link to `u`, titled `t` | refused |
| `[x](<u>)` | a link to `u` | refused |
| `![alt](u)` | an image | refused |
| a nested list marker | a list inside the item | refused |
| a blank line inside an item | two paragraphs | refused |
| `-     code`, five spaces after the dash | an indented code block in the item | refused |

### What is accepted and still read differently

**This is the half the title used to claim did not exist.** Each of these
parses without complaint and produces a document GitHub does not:

| written | GitHub reads | this subset |
| --- | --- | --- |
| `_a_`, `__a__` | emphasis, strong | plain text |
| `\\*a\\*` elsewhere than a link | the literal `*a*` | refused since a backslash is |
| a backtick run inside a span | one span holding it | two spans |
| `&amp;` | an entity | plain text |
| `<br>`, `Array<T>` outside code | raw HTML | plain text |
| `<https://…>` | an autolink | plain text |
| a line ending in two spaces or a backslash | a hard line break | joined with a space |
| `- # h`, `- > q`, `- 1. x`, `- - a` | a heading, quote or list in the item | prose |
| `  1. x`, `  # h` on a continuation | the same | prose |

The last two rows are the sharpest: an indented `- child` **is** refused, as a
nested list, while the other markers at the same position are read as prose.
The refusal is not wrong; it is alone.

Also refused, and worth naming because each is ordinary prose a release
author may write: `[WIP]` and any other bracket that opens no link, `2*3` and
any other lone asterisk, and a tab anywhere. The first two are refused for
the flanking and label rules above, the last because no rule admits it.

### The list is open, and that is the shape of the problem

CommonMark defines far more than this subset reads, and each round of review
finds more of it. The refusals are cheap and correct one at a time; what they
do not do is bound the set, and the table above is the evidence — it grew
from nothing to twelve rows without a line of the grammar changing.

**The alternative this file does not take** is deciding that a released file
is read by a conformant reader rather than by a grammar for the subset its
entries have happened to use. That is a larger question than any row here,
and the one to weigh if the list keeps growing.

Three of the twelve would have produced the **wrong address** rather than a
different rendering: a destination stopped at the first `)`, one that
swallowed a title, and one that kept its angle brackets. Those are the reason the refusals are worth their cost.

None of the refusals appears in the tree. Measured by parsing rather than by
pattern: of its several hundred emphasised spans, none is padded and none holds a
backtick or bracket; no code span is padded; no entry holds two adjacent
backticks, a label with a span opener, a target with a parenthesis or a
space or opening with `<`, an image, a nested marker, a code block opening
it, or a blank line inside it.

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
  shape of problem as the destination, and the same answer applies. A code
  span's padding is stripped in the same pass.
- **Delimiter flanking**, which decides whether an asterisk opens emphasis
  at all. The refusal here is the blunt half of CommonMark's rule — no
  space beside the delimiter — and the rule itself looks at what is on
  both sides. It belongs with the nesting work rather than before it.
- **Images and link titles**, if a release note is ever to carry either.
  Neither is asked for by `changelog/README.md`, so this is last.

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
