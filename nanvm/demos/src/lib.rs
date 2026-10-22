//! The WASM demo pages' samples (`todo/wasm-demos.md`), compiled by `fjs
//! compile` into `gen.samples/` and built for `wasm32-unknown-unknown` by the
//! deployment build. A page loads a sample with its export, runs it with
//! [`run_sample`], and then reads what the sample wrote to standard output,
//! one byte at a time, with [`output_byte`]: the page is FunctionalScript,
//! which can call a function but cannot construct a view of the module's
//! memory.

use nanvm_effects_node::{Native, run};
use nanvm_lib::{
    naive::Naive,
    vm::{Any, Array, Function, Nullish, Object, ToAny, ToArray, Unpacked, unstable::string_any},
};
use std::cell::RefCell;

/// The compiled samples. `npm run gen` writes `gen.samples/mod.rs`; one
/// `#[path]` names that file, since a `gen.` name is never a Rust identifier.
#[path = "../gen.samples/mod.rs"]
pub mod samples;

/// A compiled module: what `fjs compile` writes as `module`, a function of
/// the runtime value, on the VM the samples run on.
pub type Module = fn(Any<Naive>) -> Result<Any<Naive>, Any<Naive>>;

/// Loads a sample: initializes its module with the runtime value, and answers
/// its `default` export, or what it threw.
pub fn load(module: Module) -> Result<Function<Naive>, Any<Naive>> {
    let exports = Object::try_from(module(nanvm_lib::vm::runtime::<Naive>()?)?)
        .map_err(|_| Any::from("module is not an object"))?;
    exports
        .own_property(&"default".into())
        .and_then(|value| Function::try_from(value).ok())
        .ok_or_else(|| Any::from("module has no default function"))
}

/// Performs a sample's entry: calls it with no arguments, and performs the
/// effect it answers with an empty standard input. Answers what the sample
/// wrote to standard output, or what it threw.
pub fn perform(entry: &Function<Naive>) -> Result<Vec<u8>, Any<Naive>> {
    let effect = entry.call([].to_array())?;
    let mut host = Native::new(std::io::empty(), Vec::new(), Vec::new());
    let result = run(effect, |command, payload| host.perform(command, payload))?;
    output(result, host.stdout().clone())
}

/// Calls a sample's entry with one number, as a page calls a function
/// sample: what it answered, or what it threw, each as [`spell`] writes it.
pub fn call(
    entry: &Function<Naive>,
    input: f64,
) -> Result<std::string::String, std::string::String> {
    entry
        .call([input.to_any()].to_array())
        .map(spell)
        .map_err(spell)
}

/// A value as the page spells it, as `fjs/nanvm/demos/spell` does for the
/// JavaScript call: a string quoted as JSON quotes it, a `bigint` with its
/// `n`, an array and an object with their nesting and no spaces, a function
/// as `(function)`, and anything else as `String(value)` spells it.
pub fn spell(value: Any<Naive>) -> std::string::String {
    match Unpacked::from(value.clone()) {
        Unpacked::Array(items) => {
            let items: Vec<_> = items.into_iter().map(spell).collect();
            format!("[{}]", items.join(","))
        }
        Unpacked::Object(object) => {
            let entries: Vec<_> = object
                .own_entries()
                .into_iter()
                .map(|(key, item)| format!("{}:{}", quote(key.to_any()), spell(item)))
                .collect();
            format!("{{{}}}", entries.join(","))
        }
        Unpacked::String(_) => quote(value),
        Unpacked::BigInt(_) => format!("{}n", text(value)),
        Unpacked::Function(_) => "(function)".into(),
        Unpacked::Nullish(Nullish::Undefined) => "undefined".into(),
        _ => text(value),
    }
}

/// A string value as JSON quotes it.
fn quote(string: Any<Naive>) -> std::string::String {
    string
        .to_json()
        .unwrap_or_else(|error| format!("(not a string: {error})"))
}

/// A value as `String(value)` spells it, or the text of what that threw.
fn text(value: Any<Naive>) -> std::string::String {
    match value.to_string() {
        Ok(string) => string.into(),
        Err(thrown) => format!("String() threw on it: {}", text(thrown)),
    }
}

/// Holds a function sample's call to the answer its page lists: returned,
/// or thrown, as the samples list says JavaScript does. The generated tests
/// in `gen.samples/mod.rs` make one call of it per listed call.
#[cfg(test)]
pub(crate) fn assert_call(entry: &Function<Naive>, input: f64, expected: Result<&str, &str>) {
    let expected = expected.map(Into::into).map_err(Into::into);
    assert_eq!(call(entry, input), expected, "called with {input}");
}

/// What a program wrote, if it ended `['ok', value]`. One that ended
/// `['error', value]` failed, as the JavaScript run reports it, and its
/// result is the error.
fn output(result: Any<Naive>, stdout: Vec<u8>) -> Result<Vec<u8>, Any<Naive>> {
    let tag = Array::try_from(result.clone())
        .ok()
        .and_then(|items| items.into_iter().next());
    if tag == Some(string_any("ok")) {
        Ok(stdout)
    } else {
        Err(result)
    }
}

thread_local! {
    /// The entry of the sample loaded last, for [`run_sample`] to call.
    static ENTRY: RefCell<Option<Function<Naive>>> = const { RefCell::new(None) };
    /// What the last sample run wrote, for [`output_byte`] to read.
    static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

/// Loads `module` and keeps its entry for [`run_sample`]: `0`, or `-1` if
/// the module threw. Apart from the run, so that a page times the entry call
/// alone, as it does the JavaScript one, whose module the page imported.
fn export(module: Module) -> i32 {
    let entry = load(module);
    let status = if entry.is_ok() { 0 } else { -1 };
    ENTRY.with(|kept| *kept.borrow_mut() = entry.ok());
    status
}

/// Runs the sample loaded last and keeps its output. Answers the output's
/// length in bytes, or `-1` if no sample is loaded or the sample threw.
#[unsafe(no_mangle)]
pub extern "C" fn run_sample() -> i32 {
    let ran = ENTRY.with(|kept| kept.borrow().as_ref().map(perform));
    match ran {
        Some(Ok(bytes)) => {
            let length = bytes.len() as i32;
            OUTPUT.with(|output| *output.borrow_mut() = bytes);
            length
        }
        _ => -1,
    }
}

/// Calls the sample loaded last with `input` and keeps the text of its
/// answer for [`output_byte`]. Answers the text's length in bytes where the
/// call returned, `-1 - length` where it threw, and `i32::MIN` if no sample
/// is loaded.
#[unsafe(no_mangle)]
pub extern "C" fn call_sample(input: f64) -> i32 {
    let Some(called) = ENTRY.with(|kept| kept.borrow().as_ref().map(|entry| call(entry, input)))
    else {
        return i32::MIN;
    };
    let (bytes, threw) = match called {
        Ok(answer) => (answer.into_bytes(), false),
        Err(thrown) => (thrown.into_bytes(), true),
    };
    let length = bytes.len() as i32;
    OUTPUT.with(|output| *output.borrow_mut() = bytes);
    if threw { -1 - length } else { length }
}

/// The `index`th byte the last sample run wrote.
#[unsafe(no_mangle)]
pub extern "C" fn output_byte(index: u32) -> u32 {
    OUTPUT.with(|output| output.borrow()[index as usize].into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hello_writes_its_greeting() {
        assert_eq!(
            perform(&load(samples::hello::module::<Naive>).unwrap()).unwrap(),
            b"hello, world\n"
        );
    }

    #[test]
    fn sort_reports_what_it_sorted() {
        assert_eq!(
            perform(&load(samples::sort::module::<Naive>).unwrap()).unwrap(),
            b"sorted 100000 integers: smallest 1, largest 2147477497\n"
        );
    }

    #[test]
    fn collatz_reports_the_longest_chain() {
        assert_eq!(
            perform(&load(samples::collatz::module::<Naive>).unwrap()).unwrap(),
            b"the longest Collatz chain below 30000 starts at 26623 and takes 307 steps\n"
        );
    }

    #[test]
    fn comma_answers_or_fails_its_assertion() {
        let entry = load(samples::comma::module::<Naive>).unwrap();
        assert_eq!(call(&entry, 1.0), Ok("3".into()));
        assert_eq!(call(&entry, -1.0), Err("\"negative\"".into()));
    }

    #[test]
    fn an_error_result_is_the_sample_failing() {
        let ended = |tag| [string_any(tag), string_any("x")].to_array().to_any();
        assert_eq!(output(ended("ok"), b"hi".to_vec()).unwrap(), b"hi");
        assert!(output(ended("error"), b"hi".to_vec()).is_err());
    }

    #[test]
    fn the_exports_load_run_and_keep_the_output() {
        assert_eq!(run_sample(), -1);
        assert_eq!(samples::hello(), 0);
        assert_eq!(run_sample(), 13);
        assert_eq!(output_byte(0), u32::from(b'h'));
        assert_eq!(output_byte(12), u32::from(b'\n'));
        assert_eq!(samples::comma(), 0);
        assert_eq!(call_sample(1.0), 1);
        assert_eq!(output_byte(0), u32::from(b'3'));
        assert_eq!(call_sample(-1.0), -1 - 10);
        assert_eq!(output_byte(1), u32::from(b'n'));
    }
}
