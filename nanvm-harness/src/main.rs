//! Thin `main`: instantiates the walking-skeleton pipeline against
//! `nanvm-lib`'s `Naive` `IVm` (the only concrete implementation in the
//! repository today) for the constant-number fixture's real compiler
//! output, and prints its JSON result to stdout. `cargo test` (`src/lib.rs`)
//! is what proves the pipeline against all three fixtures; this binary
//! exists because the pipeline it runs (`fjs compile <module> <output>.rs`
//! + `cargo run`) ends in a runnable executable, not just a test suite.

use nanvm_harness::{generated, run};
use nanvm_lib::naive::Naive;

fn main() {
    match run::<Naive>(generated::number::module) {
        Ok(json) => println!("{json}"),
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    }
}
