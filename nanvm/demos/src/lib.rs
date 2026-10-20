//! The WASM demo pages' samples (`todo/wasm-demos.md`), compiled by `fjs
//! compile` into `gen.samples/` and built for `wasm32-unknown-unknown` by the
//! deployment build. A page calls a sample's export and then reads what the
//! sample wrote to standard output, one byte at a time, with
//! [`output_byte`]: the page is FunctionalScript, which can call a function
//! but cannot construct a view of the module's memory.

use nanvm_effects_node::{Native, run};
use nanvm_lib::{
    naive::Naive,
    vm::{Any, Function, Object, ToArray},
};
use std::cell::RefCell;

/// The compiled samples. `npm run gen` writes `gen.samples/mod.rs`; one
/// `#[path]` names that file, since a `gen.` name is never a Rust identifier.
#[path = "../gen.samples/mod.rs"]
pub mod samples;

/// A compiled module: what `fjs compile` writes as `module`, a function of
/// the runtime value, on the VM the samples run on.
pub type Module = fn(Any<Naive>) -> Result<Any<Naive>, Any<Naive>>;

/// Performs a sample: initializes it with the runtime value, calls its
/// `default` export with no arguments, and performs the effect it answers
/// with an empty standard input. Answers what the sample wrote to standard
/// output, or what it threw.
pub fn perform(module: Module) -> Result<Vec<u8>, Any<Naive>> {
    let exports = Object::try_from(module(nanvm_lib::vm::runtime::<Naive>()?)?)
        .map_err(|_| Any::from("module is not an object"))?;
    let entry = exports
        .own_property(&"default".into())
        .and_then(|value| Function::try_from(value).ok())
        .ok_or_else(|| Any::from("module has no default function"))?;
    let effect = entry.call([].to_array())?;
    let mut host = Native::new(std::io::empty(), Vec::new(), Vec::new());
    run(effect, |command, payload| host.perform(command, payload))?;
    Ok(host.stdout().clone())
}

thread_local! {
    /// What the last sample run wrote, for [`output_byte`] to read.
    static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

/// Performs `module`, keeps its output, and answers its length in bytes, or
/// `-1` if the sample threw.
fn export(module: Module) -> i32 {
    match perform(module) {
        Ok(bytes) => {
            let length = bytes.len() as i32;
            OUTPUT.with(|output| *output.borrow_mut() = bytes);
            length
        }
        Err(_) => -1,
    }
}

/// The `index`th byte the last sample run wrote.
#[unsafe(no_mangle)]
pub extern "C" fn output_byte(index: u32) -> u32 {
    OUTPUT.with(|output| output.borrow()[index as usize].into())
}

/// Runs the "hello, world" sample.
#[unsafe(no_mangle)]
pub extern "C" fn hello() -> i32 {
    export(samples::hello::module::<Naive>)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hello_writes_its_greeting() {
        assert_eq!(
            perform(samples::hello::module::<Naive>).unwrap(),
            b"hello, world\n"
        );
    }

    #[test]
    fn the_export_keeps_the_output() {
        assert_eq!(hello(), 13);
        assert_eq!(output_byte(0), u32::from(b'h'));
        assert_eq!(output_byte(12), u32::from(b'\n'));
    }
}
