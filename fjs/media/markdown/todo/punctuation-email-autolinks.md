## Punctuation-ending email autolinks

**Priority:** P2
**Status:** open

`proseSpans(true)('a!@example.com')` accepts plain text, while GitHub renders
an extended email autolink. `emailAt` checks the character immediately before
`@` against an incomplete set of local-part characters. GFM permits `!` and
other punctuation there.

Recognize these email candidates and either refuse them or render the same
`mailto:` link. Cover punctuation-ending addresses in plain and emphasized
prose; preserve code contents and suppression of nested links in link labels.
No implementation is included in this task.

Related: [PR review comment](https://github.com/functionalscript/functionalscript/pull/3138#discussion_r4344549082).
