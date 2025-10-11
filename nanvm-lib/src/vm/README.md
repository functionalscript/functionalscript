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
/// let n = 5.0.to_expression();
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
    fn arg(n: u32) -> Expression;
    /// `===`
    /// Note: we can't use `trait PartialEq` because it returns `bool` but we need Expression.
    fn eq(self, b: Expression) -> Expression;
    /// `?:`
    fn if_(self, a: Expression, b: Expression) -> Expression;
    ///
    fn property(self, name: Expression) -> Expression;
    /// call
    fn call(self, a: impl IntoIterator<Item = Expression>) -> Expression;
    fn propertyCall(self, property: Expression, a: impl IntoIterator<Item = Expression>);
    // ...

    /// Creates a function from the expression.
    fn function(self, length: u32, name: Expression) -> Expression;

    /// Should panic if the expression is not computable, for example, if it depends on arg
    fn compute<A: IVm>(self) -> Any<IVm>;
}
```
