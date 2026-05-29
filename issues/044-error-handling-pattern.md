# 44. Follow `?` error handling pattern.

**Priority:** P3
**Status:** open

```rust
trait Any {
    type Result<T> = Result<T, Self>;
    fn to_number(Self) -> Self::Result<(Self, f64)> { ... }
    fn add(self, b: Self) -> Self::Result<Self> {
        ....
        let (b, num) = self.to_number()?;
        ...
    }
    ...
}
```
