//! `Number.prototype`'s member functions but `toString`, which every type
//! shares in `method`: the formatters, whose contracts are
//! `vm/string/README.md`'s and whose arithmetic is `vm/number/format.rs`'s.

use super::method::{Method, argument, lookup};
use crate::vm::{Any, Array, IVm, Nullish, Number, ToAny, Unpacked};

/// `Number.prototype`'s.
pub(super) fn number<A: IVm>(key: &Any<A>) -> Option<Method<A>> {
    let table: [(&str, Method<A>); 3] = [
        ("toExponential", to_exponential),
        ("toFixed", to_fixed),
        ("toPrecision", to_precision),
    ];
    lookup(table, key)
}

/// The receiver `method` matched as a number, so the conversion cannot throw.
fn receiver<A: IVm>(receiver: Any<A>) -> Result<Number, Any<A>> {
    Number::try_from(receiver)
}

/// A digit count: `ToIntegerOrInfinity` of it, or `None` when `undefined`.
fn digits<A: IVm>(v: Any<A>) -> Result<Option<f64>, Any<A>> {
    if matches!(
        Unpacked::from(v.clone()),
        Unpacked::Nullish(Nullish::Undefined)
    ) {
        return Ok(None);
    }
    Ok(Some(f64::from(v.to_number()?.to_integer_or_infinity())))
}

/// An `undefined` count is `0`, which `ToIntegerOrInfinity` answers too.
fn to_fixed<A: IVm>(n: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let x = receiver(n)?;
    let f = digits(argument(&args, 0))?.unwrap_or(0.0);
    Ok(x.to_fixed(f)?.to_any())
}

fn to_exponential<A: IVm>(n: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let x = receiver(n)?;
    let f = digits(argument(&args, 0))?;
    Ok(x.to_exponential(f)?.to_any())
}

/// An `undefined` precision is `ToString`.
fn to_precision<A: IVm>(n: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let x = receiver(n)?;
    match digits(argument(&args, 0))? {
        None => Ok(x.to_any().to_string()?.to_any()),
        Some(p) => Ok(x.to_precision(p)?.to_any()),
    }
}
