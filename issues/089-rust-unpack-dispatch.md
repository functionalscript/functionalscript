# 89. Rust Unpack dispatch.

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
