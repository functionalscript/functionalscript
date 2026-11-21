//! The `fjsrs` executable: [`nanvm_fjsrs::run`] over this process, at the
//! reference VM.

use nanvm_effects_node::Native;
use nanvm_fjsrs::{Options, program, run};
use std::process::ExitCode;

fn main() -> ExitCode {
    match run(
        program::module,
        &Options::of_process(),
        &mut Native::stdio(),
    ) {
        Ok(code) => ExitCode::from(code),
        Err(thrown) => {
            eprintln!("fjsrs: uncaught {thrown:?}");
            ExitCode::FAILURE
        }
    }
}
