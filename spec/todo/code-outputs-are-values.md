## Describe the code outputs as values across the specification

**Priority:** P2
**Status:** open

### Problem

`fjs compile` writes `.js` and `.rs` from the module's value, initialized
and precomputed, or as a `throw` of what a failing module failed with, and
never from the program's graph
([output](../command-line/output.md#evaluation-and-projection)).
The pages written before that describe FunctionalScript and Rust as *graph
outputs* that evaluate nothing, and show for a constant program the text
the graph writer gives it: an access left as an access, a spread left as a
spread, a call left as a call. Each such example is now the text of the
graph, which the command does not write for `.js` or `.rs`.

The output contract and the command's overview are corrected. The pages
that still say otherwise, found by their wording, are among:
[modules](../modules/README.md),
[Number conversion](../conversions/number/README.md),
[static functions](../built-ins/static-functions/README.md),
[objects](../values/objects/README.md),
[arrays](../values/arrays/README.md),
[optional chaining](../property-access/optional-chaining/README.md),
[entries](../property-access/entries/README.md) and
[destructuring](../bindings/destructuring/README.md).

### Proposal

On each page, say which text is the module's value and which is the program
as written, and give an example of the second that the command produces: a
function whose body holds the construct over an argument, since a body that
reads an argument is not computed ahead.

### Tasks

- [ ] Correct each page listed, and search the rest for "graph outputs".
- [ ] Say on the [checking](../command-line/checking.md) page whether the
      check of every `.f.js` evaluates what it checks. It links and does
      not evaluate today.

### Related

- [`fjs/edag/todo/precompute-closed-nodes.md`](../../fjs/edag/todo/precompute-closed-nodes.md)
  — the experiment that made the code outputs values.
