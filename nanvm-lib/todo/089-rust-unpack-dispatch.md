## 89. Rust Unpack dispatch.

**Priority:** P3
**Status:** open

### Status (re-verified 2026-08-14)

A real dispatch mechanism has since landed: `nanvm-lib/src/vm/dispatch.rs`
defines a `Dispatch<A>` trait with one method per `Any` variant
(`nullish`/`bool`/`number`/`string`/`bigint`/`object`/`array`/`function`),
and it's used by the coercion visitors (`number_coercion.rs`,
`string_coercion.rs`, `primitive_coercion.rs`) to unpack an `Any<A>` and
route to variant-specific logic. That satisfies the "match once on the
`Unpacked` variant, call out to a trait impl" half of this sketch.

What it does *not* do is what the sketch below actually proposed: a
compile-time `Unary<Operation>` tag (`UnaryPlus`, `UnaryMinus`, etc.)
where the *operation* is a generic parameter and each numeric type
implements `Unary<Tag>` per operation, letting `Unpack` dispatch on both
axes (value variant × operation tag) through the type system. `Dispatch<A>`
only dispatches on the value variant at runtime — there's no tag type,
and no generic `do::<Operation>()`. For example, `nanvm-lib/src/vm/any/neg.rs`
still hand-implements `Neg for Any<A>` with a direct `match self.to_numeric()`
over `Numeric::Number`/`Numeric::BigInt`, not through `Dispatch` or any
`Unary<Operation>`-style trait.

So: the runtime-dispatch-over-variants idea is done via `Dispatch<A>`.
The compile-time operation-tag idea below is still an open proposal,
not implemented anywhere.

```rust
trait Unary<Tag> {
    type Result;
    fn do(self) -> Self::Result;
}

struct UnaryPlus;
impl Unary<UnaryPlus> for f64 {
    type Result = Any;
    fn do(self) -> Self::Result;
}

impl<Operation> Unary<Operation> Unpack {
    type Result = Any;
    fn do(self) -> Self::Result {
        match ... {
            Number(v) => v.do::<Operation>(),
            ...
        }
    }
}
```
