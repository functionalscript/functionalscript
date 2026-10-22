## GitHub inline math

**Priority:** P2
**Status:** open

`tryParseEntry('$x^2$')` accepts literal text, while GitHub renders an inline
mathematical expression. The README renderer therefore produces a different
document without reporting an unsupported construct.

Detect GitHub's inline math syntax and either refuse it or render it
equivalently. Consider delimiters split across inline spans, including the
dollar/backtick form. Keep code contents and link destinations literal, and
distinguish ordinary currency from math where supported. No implementation is
included in this task.

Related: [PR review comment](https://github.com/functionalscript/functionalscript/pull/3138#discussion_r4344549090).
