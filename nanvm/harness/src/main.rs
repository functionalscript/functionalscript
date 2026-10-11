//! Thin `main`: instantiates the walking-skeleton pipeline against
//! `nanvm-lib`'s `Naive` `IVm` (the only concrete implementation in the
//! repository today) for the generated constant-number module, and prints
//! its JSON result to stdout. `cargo test` (`src/lib.rs`) is what actually
//! proves the pipeline against every generated fixture; this binary
//! exists because the pipeline this crate wires up
//! (`fjs compile <module> <output>.rs` + `cargo run`) ends in a runnable
//! executable, not just a test suite.
//!
//! There is no CLI. Choosing a module at run time would mean choosing among
//! the modules compiled into the binary, and arguments on a command line
//! would need a text form `nanvm-lib` cannot read; a CLI is its own task
//! once a use for it exists.

use nanvm_harness::{Action, fixtures::number, run};
use nanvm_lib::naive::Naive;

fn main() {
    match run::<Naive>(number::module, "default", Action::Read) {
        Ok(json) => println!("{json}"),
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    }
}
