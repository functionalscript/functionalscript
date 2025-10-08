# VM

## Internal Traits

```rust
trait IContainer;
trait IVm {
    type String;
    // ...
}
```

## Types

Concrete types.

```rust
struct Any<T: IVm>;
struct String<T: IVm>;
// ...
```

## ByteCode

Byte code is a VM agnostic.

```rust
/// ```
/// let t = true.to_expression();
/// let n = n.to_expression();
/// let m = t + n;
/// ```
struct Expression {}

trait ToExpression {
    fn to_expression(self) -> Expression;
}

impl ToExpression for bool {}
impl ToExpression for f64 {}

impl ToExpression for &[u16] {}
impl ToExpression for &str {}

impl ToExpression for &[Expression] {}
impl ToExpression for &[(Expression, Expression)] {}

//...

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators

impl Add for Expression {}
impl Mul for Expression {}
// ...

impl Expression {
    /// `===`
    /// Note: we can't use `trait PartialEq` because it returns `bool` but we need Expression.
    fn eq(self, b: Expression) -> Expression;
    /// `?:`
    fn if_(self, a: Expression, b: Expression) -> Expression;
    // ...
}

struct Args(n: u32);

trait ToArgs {
    fn to_args(self) -> Args;
}

impl ToArgs for u32 {}

impl Index<u32> for Args {
    fn index(i: u32) -> Expression;
}
```
