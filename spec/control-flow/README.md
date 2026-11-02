# Control Flow

Function bodies support terminating `if` guards, normally completing
conditionals with at most one assigned outer binding, `return`, `throw`,
`while` loops and terminating switches. Functions still state their result
with an explicit terminator. Loops retain multiple state values and may contain
nested loops, conditional arms, `break`, `continue`, owning-function returns,
throws and switches with braced cases.

## Pages

- [Bodies and Guards](./guards/README.md)
- [Loops](./loops/README.md)
- [Switch](./switch/README.md)

Refused by design, each page showing what `fjs compile` prints and what to write instead:

- [A `default` Before a `case` Is Refused](./switch/default-position/README.md)

## Reference

- ECMA-262: see each page.
