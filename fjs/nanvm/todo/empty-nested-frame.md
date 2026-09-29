## empty-nested-frame. The corpus builds a nested function's frame the writer refuses

**Priority:** P4
**Status:** open

### Problem

The corpus lowers its smallest function, `lambdaExp`, with an empty frame,
`['[]', []]`. The parser never builds one: a function that captures nothing
has a `null` frame. `tryFunctionText` spells an outer function's frame
itself, but refuses an empty frame on a nested function (`an empty frame`),
since the text reads back as `null`. So `returns(functionValue)` has no text
in Rust and no corpus case can show the text of a function that returns a
function.

### Proposal

Lower `lambdaExp` with a `null` frame, as the parser does, and update the
consumers that recognize it (`isSmallestLambda` in `fjs/edag/rust`, and
`amnesia`'s proof). Then add a `host` case for `String(returns(functionValue))`.

### Tasks

- [ ] `lambdaExp` with a `null` frame, and its consumers.
- [ ] `tsc`, `fjs test`, `npm run gen`, `cargo test`.

### Related

- [../../../nanvm-lib/todo/to-primitive.md](../../../nanvm-lib/todo/to-primitive.md): Stage 3.
