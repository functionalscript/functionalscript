## fjs/fsc/README.md checklists predate the compiler

**Priority:** P4
**Status:** open

### Problem

The "Next steps" and "Decidable Language" checklists in
[`../README.md`](../README.md) are an early roadmap that no longer matches the
compiler. They leave unticked features that parse and compile today:

- "using operator and functions" — operators and functions are in the
  language; at `36c8d4a`, `const a = 2+2;` parses, and only `Math.abs` is
  refused (`const not found`), which is
  [global-names](../../../spec/todo/2365-global-names.md) and
  [built-in](../../../spec/todo/2360-built-in.md);
- "decidable functions?" — `const f = a => b => a + b; export default f(1)(2);`
  compiles to `.rs` and `.edag.data.js`.

The one remaining open box, "short form" `{ a }`, is
[shorthand](../../../spec/todo/2440-shorthand.md). The spec roadmap,
[`spec/todo/README.md`](../../../spec/todo/README.md), is where these items
are tracked; the README keeps a second, drifting copy.

### Tasks

- [ ] Replace both checklists with links to the matching `spec/todo/` entries,
      or delete them, leaving the README to describe what the compiler does.

### Related

- [`spec/todo/README.md`](../../../spec/todo/README.md) — the language
  roadmap.
