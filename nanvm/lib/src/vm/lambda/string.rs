//! `String.prototype`'s member functions the VM answers natively: the table
//! `method` consults for a string receiver, and one adapter per built-in
//! reading the call's arguments into the typed method it calls, under
//! `vm/string/`. The contracts are `vm/string/README.md`'s. A name the
//! runtime defines — `startsWith`, `codePointAt` — has no entry here: the
//! call step finds its body through the runtime value (`vm/runtime.rs`).

use super::method::{Method, ToAnyResult, index_or_minus_one};
use crate::vm::{Any, Array, IVm, String, ToAny};

/// `String.prototype`'s.
pub(super) fn string<A: IVm>() -> [(&'static str, Method<A>); 23] {
    [
        ("at", at),
        ("charAt", char_at),
        ("charCodeAt", char_code_at),
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
        ("substring", substring),
        ("toLowerCase", to_lower_case),
        ("toUpperCase", to_upper_case),
        ("toWellFormed", to_well_formed),
        ("trim", trim),
        ("trimEnd", trim_end),
        ("trimStart", trim_start),
    ]
}

fn at<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?.at(args.argument(0))
}

fn char_at<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?
        .char_at(args.argument(0))
        .to_any_result()
}

fn char_code_at<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?
        .char_code_at(args.argument(0))
        .to_any_result()
}

fn is_well_formed<A: IVm>(s: Any<A>, _: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(String::try_from(s)?.is_well_formed().to_any())
}

fn to_well_formed<A: IVm>(s: Any<A>, _: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(String::try_from(s)?.to_well_formed().to_any())
}

fn to_lower_case<A: IVm>(s: Any<A>, _: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?.to_lower_case().to_any_result()
}

fn to_upper_case<A: IVm>(s: Any<A>, _: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?.to_upper_case().to_any_result()
}

fn includes<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?
        .includes(args.argument(0), args.argument(1))
        .to_any_result()
}

fn index_of<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let found = String::try_from(s)?.index_of(args.argument(0), args.argument(1))?;
    Ok(index_or_minus_one(found))
}

fn last_index_of<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let found = String::try_from(s)?.last_index_of(args.argument(0), args.argument(1))?;
    Ok(index_or_minus_one(found))
}

fn ends_with<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?
        .ends_with(args.argument(0), args.argument(1))
        .to_any_result()
}

fn slice<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?
        .slice(args.argument(0), args.argument(1))
        .to_any_result()
}

fn substring<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?
        .substring(args.argument(0), args.argument(1))
        .to_any_result()
}

/// Every argument a part.
fn concat<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?.concat(args.rest(0)).to_any_result()
}

fn repeat<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?
        .repeat(args.argument(0))
        .to_any_result()
}

fn pad_start<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?
        .pad(args.argument(0), args.argument(1), true)
        .to_any_result()
}

fn pad_end<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?
        .pad(args.argument(0), args.argument(1), false)
        .to_any_result()
}

fn trim<A: IVm>(s: Any<A>, _: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(String::try_from(s)?.trim(true, true).to_any())
}

fn trim_start<A: IVm>(s: Any<A>, _: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(String::try_from(s)?.trim(true, false).to_any())
}

fn trim_end<A: IVm>(s: Any<A>, _: Array<A>) -> Result<Any<A>, Any<A>> {
    Ok(String::try_from(s)?.trim(false, true).to_any())
}

fn replace<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?
        .replace(args.argument(0), args.argument(1))
        .to_any_result()
}

fn replace_all<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?
        .replace_all(args.argument(0), args.argument(1))
        .to_any_result()
}

fn split<A: IVm>(s: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    String::try_from(s)?
        .split(args.argument(0), args.argument(1))
        .to_any_result()
}
