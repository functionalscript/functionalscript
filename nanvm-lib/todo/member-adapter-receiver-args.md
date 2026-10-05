## member-adapter-receiver-args. The built-in adapters spell the receiver conversion three ways and wrap every answer by hand

**Priority:** P4
**Status:** open

### Problem

The tables in `vm/lambda/method.rs`, `vm/lambda/string.rs` and
`vm/lambda/number.rs` map a member name to an adapter of one shape,
`fn(Any<A>, Array<A>) -> Result<Any<A>, Any<A>>` — about fifty of them
at `ef756f0`. Every adapter does the same three things around its
one call: convert the receiver to its type, read its arguments with
`argument(&args, i)`, and wrap the typed answer with `Ok(….to_any())`:

```rust
// vm/lambda/string.rs, slice
Ok(receiver(s)?.slice(argument(&args, 0), argument(&args, 1))?.to_any())
// vm/lambda/method.rs, array_slice
let a = Array::try_from(receiver)?;
Ok(a.slice(argument(&args, 0), argument(&args, 1))?.to_any())
```

The receiver conversion alone is spelled three ways: `string.rs` and
`number.rs` each keep a private `receiver` (`String::try_from`,
`Number::try_from`, with the same doc about why it cannot throw), and
`method.rs` writes `Array::try_from(receiver)?` inline about a dozen
times, once more inside `with_callback`.
[member-functions](./member-functions.md) is going to add an adapter
per missing built-in, each copying this shape again.

### Proposal

The shape becomes three small pieces in `method.rs`, next to `argument`:

```rust
/// The receiver as the type the table matched; the conversion cannot throw there.
fn receiver<A: IVm, T: TryFrom<Any<A>, Error = Any<A>>>(receiver: Any<A>) -> Result<T, Any<A>>

/// The argument list as a built-in reads it: `at(i)` is `argument`,
/// `present(i)` and `rest(i)` the two functions of those names today.
struct Args<A: IVm>(Array<A>);

/// `Ok(x?.to_any())`, once. `ToAny` has no type parameter; its `to_any`
/// is generic and asks `Self: Into<A>`, so that is the bound here too.
trait ToAnyResult<A: IVm> { fn to_any_result(self) -> Result<Any<A>, Any<A>>; }
impl<A: IVm, T: Into<A>> ToAnyResult<A> for Result<T, Any<A>> { … }
```

An adapter is then one expression —
`receiver::<_, String<A>>(s)?.slice(args.at(0), args.at(1)).to_any_result()`
— and the two private `receiver`s are deleted. The `Method` fn-pointer
tables keep their shape; only the adapters' bodies change.

### Tasks

- [ ] Generic `receiver`, `Args`, `ToAnyResult` in `vm/lambda/method.rs`.
- [ ] The adapters in `method.rs`, `string.rs` and `number.rs` through
      them; the two private `receiver`s deleted.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [member-functions](./member-functions.md) — every adapter it adds
  copies this shape; land this first or with its first batch.
- [any-receiver-prologue](./any-receiver-prologue.md) — the receiver
  guard on the `Member` side, before the table is consulted.
- [any-result-alias](./any-result-alias.md) — the error type every
  adapter signature names.
