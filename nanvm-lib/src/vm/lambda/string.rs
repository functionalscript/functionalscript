//! `String.prototype`'s member functions: the table `method` consults for a
//! string receiver, and one adapter per built-in reading the call's
//! arguments into the typed method it calls, under `vm/string/`. The
//! contracts are `nanvm-lib/todo/string-member-functions.md`'s.

use super::method::{Method, argument, lookup};
use crate::vm::{Any, Array, IVm, Number, String, ToAny};

/// `String.prototype`'s.
pub(super) fn string<A: IVm>(key: &Any<A>) -> Option<Method<A>> {
    let table: [(&str, Method<A>); 6] = [
        ("at", at),
        ("charAt", char_at),
        ("charCodeAt", char_code_at),
        ("codePointAt", code_point_at),
        ("isWellFormed", is_well_formed),
        ("toWellFormed", to_well_formed),
    ];
    lookup(table, key)
}

/// The receiver `method` matched as a string, so the conversion cannot throw.
fn receiver<A: IVm>(receiver: Any<A>) -> Result<String<A>, Any<A>> {
    String::try_from(receiver)
}

fn at<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    receiver(s)?.at(argument(&args, 0))
}

fn char_at<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?.char_at(argument(&args, 0))?.to_any())
}

fn char_code_at<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?.char_code_at(argument(&args, 0))?.to_any())
}

/// The code point as a number, or `undefined` out of range.
fn code_point_at<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?.code_point_at(argument(&args, 0))?.map_or_else(
        || crate::vm::Nullish::Undefined.to_any(),
        |c| Number::from(f64::from(c)).to_any(),
    ))
}

fn is_well_formed<A: IVm>(s: Any<A>, _: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?.is_well_formed().to_any())
}

fn to_well_formed<A: IVm>(s: Any<A>, _: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?.to_well_formed().to_any())
}
