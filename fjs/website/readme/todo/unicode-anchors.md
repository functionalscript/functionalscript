## Unicode heading anchors

**Priority:** P3
**Status:** open

The anchor classifier does not have GitHub's Unicode category tables. The
Letterlike Symbols block U+2100–U+214F mixes letters, such as `ℂ` (U+2102),
with symbols. Treating the whole block as punctuation silently drops letters.
These characters now refuse README rendering rather than produce a wrong
anchor. Support them using the relevant Unicode categories before admitting
them; preserve letters and drop symbols as GitHub does.
