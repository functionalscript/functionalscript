# Unstable helpers

Functions that shorten generated code. They are not part of the crate's API:
nothing here is stable, and any of them may change, move, or disappear in
any release.

`fjs compile <input> <output>.rs` prints a FunctionalScript module as Rust
that depends on this crate and nothing else, and the operator corpus in
`tests/test/gen.corpus/` is printed by the same printer, so what both would
otherwise repeat is defined here, once, rather than copied into every
generated file. The module is also how the crate learns what writing code
against the VM API actually needs: a helper that keeps earning its calls is
a candidate for the `vm` API proper; one that does not is dropped.

Anyone — a person or an agent — adding to the printers is encouraged to add
a helper here and print a call to it, rather than printing the same
expression again. Each is a plain function on purpose: `Any` stays simple,
and a generated module needs no sugar.

Today's helpers are the values a literal becomes, each pinning the `A` a
bare `into()` cannot infer at the point of use, and the two equality
operators, `===` and `!==`: their `nanvm-lib` form is `PartialEq`, which
answers a `bool`, and generated code wants the `Result<Any<A>, Any<A>>`
every other operator returns.
