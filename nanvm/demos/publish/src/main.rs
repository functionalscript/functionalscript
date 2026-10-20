//! Puts the WASM demo pages' module where the site serves it
//! (`todo/wasm-demos.md`). The deployment build runs it after building
//! `nanvm-demos` for `wasm32`: `cargo` writes the module under `target/`,
//! which the site does not serve, and this copies it out, making the
//! directory first.
//!
//! `nanvm-demos-publish <built .wasm> <published .wasm>`

use std::{env, fs, io, path::Path, process::ExitCode};

/// Copies `from` to `to`, making `to`'s directory first.
fn publish(from: &Path, to: &Path) -> io::Result<()> {
    if let Some(directory) = to.parent() {
        fs::create_dir_all(directory)?;
    }
    fs::copy(from, to)?;
    Ok(())
}

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();
    let [from, to] = args.as_slice() else {
        eprintln!("usage: nanvm-demos-publish <built .wasm> <published .wasm>");
        return ExitCode::FAILURE;
    };
    match publish(Path::new(from), Path::new(to)) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{from} -> {to}: {e}");
            ExitCode::FAILURE
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Against a real directory, which a WebAssembly host does not give a
    /// test.
    #[cfg(not(target_family = "wasm"))]
    #[test]
    fn publish_makes_the_directory_and_copies() {
        let root = env::temp_dir().join(format!("nanvm-demos-publish-{}", std::process::id()));
        let from = root.join("built.wasm");
        let to = root.join("a/b/published.wasm");
        fs::create_dir_all(&root).unwrap();
        fs::write(&from, b"\0asm").unwrap();
        publish(&from, &to).unwrap();
        assert_eq!(fs::read(&to).unwrap(), b"\0asm");
        fs::remove_dir_all(&root).unwrap();
    }

    /// Relative paths, which every host the tests run on can resolve; the
    /// copy fails before anything is written.
    #[test]
    fn publish_refuses_a_missing_module() {
        assert!(publish(Path::new("missing.wasm"), Path::new("never-written.wasm")).is_err());
        assert!(!Path::new("never-written.wasm").exists());
    }
}
