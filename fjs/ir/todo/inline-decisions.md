## Inline decisions from a profile

**Priority:** P3
**Status:** open

### Problem

The [inline pass](../inline/module.f.js) inlines only the calls of a
function hinted `inline: 'always'`. A function with no hint keeps its
calls, and so does one hinted `never`. Which unhinted functions are worth
a copy is a question for a profile of the program: how often each call
runs, and how large the body is.

### Proposal

A decision file, written from a profiling run, that names the functions
to inline. It decides only the functions with no hint: a hint wins over
it. An entry for a function that the module no longer has is refused, so
a stale profile is an error and not a silent no-op.

The pass reads its decisions from one function, `inlined`, which answers
from the hints today. The file feeds that function and nothing else.

### Drawbacks

- The pass needs call counts, which nothing collects yet: the counting
  host counts L0 calls, not calls of the module's own functions.
- A name is the key, so a rename of a runtime function stales every
  profile that names it.
