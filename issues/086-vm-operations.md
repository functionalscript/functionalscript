# 86. Operations for new VM implementation.

```rust
// not all types require to implement these traits.
trait StringCoercion {
    // link to MDN, optionally to ECMAScript
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#string_coercion
    fn string(self) -> String16
}
// not types required to implement.
trait NumberCoercion {
    // link to MDN, optionally to ECMAScript
    fn unary_plus(self) -> Result<f64, Any>
}
// ```
// fn some() -> Result<(), Any> {
//     let x = a.unary_plus()?;
//     // let y = (-a)? // `-` never throws so we don't need `?`.
//     let y = -a;
// }
// ```
trait Js: StringCoercion + NumberCoercion + Neg<Output = Any> {}

impl Js for Any {}
impl Js for Unpacked {}
```
