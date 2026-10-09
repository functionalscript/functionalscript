## Spell a refused number as ECMAScript does, to the last digit

**Priority:** P4
**Status:** open

### Problem

`readBytes` refuses a window with the words of `windowRefusal` in
`fjs/effects/node/module.f.mjs`, and those words contain the number the program
passed: `Offset 1.5 is not an integer`. `js_number` in
[`files.rs`](../src/files.rs) spells it as JavaScript does for `NaN`,
`Infinity`, zero, and the exponent forms at and beyond `1e21` and below `1e-6`.
Everywhere else it is Rust's `f64` `Display`, which is also the shortest decimal
that round-trips.

The two shortest spellings differ when two candidates of the same length both
round-trip: ECMAScript's `Number::toString` takes the even digit, Rust takes the
other. The measured case is the double nearest `1888570120608320.25`, which
Node spells `1888570120608320.2` and Rust `1888570120608320.3`. Only a
fractional value of that magnitude, from 2^50 up, has such a tie, so the
message differs for an input no program has a reason to pass. The refusal itself,
its code (none) and its place before the open are the same.

### Proposal

Write the spelling once, as ECMAScript specifies it, rather than lean on Rust's
formatter: the shortest digits, ties to even, then the exponent rules. Prove it
against a table of values measured on Node. The same function serves every later
message that names a number.

### Tasks

- [ ] Implement ECMAScript `Number::toString` for `f64` in the crate, and use it
      in `js_number`.
- [ ] Prove it on Node-measured cases, including the tie above, powers of ten
      at both exponent thresholds, `-0`, and the extremes `5e-324` and
      `1.7976931348623157e+308`.
