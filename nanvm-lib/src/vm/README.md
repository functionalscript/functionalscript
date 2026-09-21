# VM

## Internal Traits

```rust
/// A heap value: cloned by reference, compared by identity.
trait IComplex;
/// A sequence with a header: a string, a bigint, an array, an object.
trait IContainer: IComplex;
/// A function: `call`, `length`, and nothing a program cannot observe.
trait IFunction: IComplex;
trait IVm {
    type InternalString: IContainer;
    type InternalFunction: IFunction;
    // ...
}
/// A VM that makes a function out of a Rust static function.
trait IStaticFunction: IVm;
```

What a function *is* — a Rust static function, an EDAG the VM interprets,
or both — is each VM's own choice, and nothing in the core depends on it:
`IFunction` has no constructor, and a holder of a `Function<A>` can only call
it, read its `length`, and compare it by identity. A VM that binds static
functions says so through `IStaticFunction`; `naive` does, and no more.

## Types

Concrete types.

```rust
struct Any<T: IVm>;
struct String<T: IVm>;
// ...
```

`Number` is the VM's number: an `f64` that holds one `NaN`. Its only
constructor canonicalizes, whatever sign or payload a host operation left on
a `NaN`, and every operator's result passes back through it, because the
language cannot tell two `NaN`s apart and a NaN-boxing VM keeps its boxed
values in the negative quiet `NaN`s. The VM computes on it from there: the
ECMAScript operations on a number are its methods and operators, under
JavaScript's names in Rust's casing (`Number.isNaN` is `is_nan`, `ToInt32`
is `to_int32`, `**` is `pow`), and an `f64` is read back out only where a
leaf needs IEEE 754 arithmetic Rust already has.

## EDAG

The EDAG is VM-agnostic and is the stable, serializable representation of functions
(see [`spec/todo/serialization.md`](../../../spec/todo/serialization.md)).
A VM implementation may transform it into internal bytecode on loading, or use the EDAG itself
as its byte code, interpreting it directly.

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
    /// `self === b`
    /// Note: we can't use `trait PartialEq` because it returns `bool` but we need Expression.
    fn eq(self, b: Expression) -> Expression;
    /// `self ? a : b`
    fn if_(self, a: Expression, b: Expression) -> Expression;
    /// `self[name]`
    fn property(self, name: Expression) -> Expression;
    /// `self(...a)`
    fn call(self, a: impl IntoIterator<Item = Expression>) -> Expression;
    /// `self[property](...a)`
    fn propertyCall(self, property: Expression, a: impl IntoIterator<Item = Expression>);
    // ...

    /// Creates a function from the expression.
    fn function(self, length: u32, name: Expression) -> Expression;
    /// 
    fn recursive(f: FnOnce(self) -> Expression) -> Expression;

    /// Should panic if the expression is not computable, for example, if it depends on arg
    fn compute<A: IVm>(self) -> Any<IVm>;
}
```
