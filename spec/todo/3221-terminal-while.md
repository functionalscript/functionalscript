## A terminal unconditional loop

**Priority:** P2
**Status:** wip — proposal in progress; implementation awaits language-design approval

### Problem

A final `while (true)` with no break targeting that loop cannot complete
normally, yet the function-body grammar still requires a following return or
throw. Record a proposal to recognize this terminal shape while preserving
the refusal of a function that can silently fall through its closing brace.
