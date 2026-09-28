//! `String.prototype`'s member functions: the table `method` consults for a
//! string receiver, and one adapter per built-in reading the call's
//! arguments into the typed method it calls, under `vm/string/`. The
//! contracts are `vm/string/README.md`'s.

use super::method::{Method, argument, lookup, position, rest};
use crate::vm::{Any, Array, IVm, Number, String, ToAny};

/// `String.prototype`'s.
pub(super) fn string<A: IVm>(key: &Any<A>) -> Option<Method<A>> {
    let table: [(&str, Method<A>); 23] = [
        ("at", at),
        ("charAt", char_at),
        ("charCodeAt", char_code_at),
        ("codePointAt", code_point_at),
        ("concat", concat),
        ("endsWith", ends_with),
        ("includes", includes),
        ("indexOf", index_of),
        ("isWellFormed", is_well_formed),
        ("lastIndexOf", last_index_of),
        ("padEnd", pad_end),
        ("padStart", pad_start),
        ("repeat", repeat),
        ("replace", replace),
        ("replaceAll", replace_all),
        ("slice", slice),
        ("split", split),
        ("startsWith", starts_with),
        ("substring", substring),
        ("toWellFormed", to_well_formed),
        ("trim", trim),
        ("trimEnd", trim_end),
        ("trimStart", trim_start),
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

fn includes<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let found = receiver(s)?.includes(argument(&args, 0), argument(&args, 1))?;
    Ok(found.to_any())
}

fn index_of<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let found = receiver(s)?.index_of(argument(&args, 0), argument(&args, 1))?;
    Ok(position(found))
}

fn last_index_of<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let found = receiver(s)?.last_index_of(argument(&args, 0), argument(&args, 1))?;
    Ok(position(found))
}

fn starts_with<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let found = receiver(s)?.starts_with(argument(&args, 0), argument(&args, 1))?;
    Ok(found.to_any())
}

fn ends_with<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let found = receiver(s)?.ends_with(argument(&args, 0), argument(&args, 1))?;
    Ok(found.to_any())
}

fn slice<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?
        .slice(argument(&args, 0), argument(&args, 1))?
        .to_any())
}

fn substring<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?
        .substring(argument(&args, 0), argument(&args, 1))?
        .to_any())
}

/// Every argument a part.
fn concat<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?.concat(rest(&args, 0))?.to_any())
}

fn repeat<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?.repeat(argument(&args, 0))?.to_any())
}

fn pad_start<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?
        .pad(argument(&args, 0), argument(&args, 1), true)?
        .to_any())
}

fn pad_end<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?
        .pad(argument(&args, 0), argument(&args, 1), false)?
        .to_any())
}

fn trim<A: IVm>(s: Any<A>, _: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?.trim(true, true).to_any())
}

fn trim_start<A: IVm>(s: Any<A>, _: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?.trim(true, false).to_any())
}

fn trim_end<A: IVm>(s: Any<A>, _: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?.trim(false, true).to_any())
}

fn replace<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?
        .replace(argument(&args, 0), argument(&args, 1))?
        .to_any())
}

fn replace_all<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?
        .replace_all(argument(&args, 0), argument(&args, 1))?
        .to_any())
}

fn split<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(receiver(s)?
        .split(argument(&args, 0), argument(&args, 1))?
        .to_any())
}
