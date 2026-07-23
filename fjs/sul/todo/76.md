## 76. Serialization mapping should be done only once.

**Priority:** P3
**Status:** open

For example, instead of
```rust
fn serialize(v: bool) => u8 {
    if v == false { 0 } else { 1 }
}
fn deserialize(v: u8) => bool {
    if v == 0 { false } else { true }
}
```
we should have something like this
```rust
const BOOL_MAP: ... = [(false, 0), (true, 1)];
```
