//! `Number.prototype`'s member functions but `toString`, which every type
//! shares in `method`: the formatters, whose contracts are
//! `vm/string/README.md`'s and whose arithmetic is `vm/number/format.rs`'s.

use super::method::{Method, ToAnyResult};
use crate::vm::{Any, Array, IVm, Number, ToAny};

/// `Number.prototype`'s.
pub(super) fn number<A: IVm>() -> [(&'static str, Method<A>); 3] {
    [
        ("toExponential", to_exponential),
        ("toFixed", to_fixed),
        ("toPrecision", to_precision),
    ]
}

/// A digit count: `ToIntegerOrInfinity` of it, or `None` when `undefined`.
fn digits<A: IVm>(v: Any<A>) -> Result<Option<f64>, Any<A>> {
    v.defined().map(Any::to_integer_or_infinity).transpose()
}

/// An `undefined` count is `0`, which `ToIntegerOrInfinity` answers too.
fn to_fixed<A: IVm>(n: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let x = Number::try_from(n)?;
    let f = digits(args.argument(0))?.unwrap_or(0.0);
    x.to_fixed(f).to_any_result()
}

fn to_exponential<A: IVm>(n: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let x = Number::try_from(n)?;
    let f = digits(args.argument(0))?;
    x.to_exponential(f).to_any_result()
}

/// An `undefined` precision is `ToString`.
fn to_precision<A: IVm>(n: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let x = Number::try_from(n)?;
    match digits(args.argument(0))? {
        None => Ok(x.to_any().to_string()?.to_any()),
        Some(p) => x.to_precision(p).to_any_result(),
    }
}
