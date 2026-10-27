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
every other operator returns. An array spread has four: `spread_array` builds the
array an item list holds, `[a, ...b]`, as `spread_array([value_item(a),
spread_item(b)?])`, and `spread_call` calls with such a list. `spread_item`
establishes its iterator immediately and returns a `Result`, so generated code
propagates a non-iterable operand's failure before evaluating the next item.
`spread_array` and `spread_call` also return a `Result`. Arrays and strings are
the only iterables, and stepping their established iterators cannot fail or run
represented code. Array construction retains its length and allocation checks
after item evaluation. An object's, `{k: v, ...o}`, is
`spread_object([property_item(k, v), spread_entries(o)])`, a value, since an
object spread never throws (`Any::object_spread`).
