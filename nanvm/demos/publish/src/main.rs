//! Puts the WASM demo pages' module where the site serves it
//! (`todo/wasm-demos.md`), with its disassembly. The deployment build runs it
//! after building `nanvm-demos` for `wasm32`: `cargo` writes the module under
//! `target/`, which the site does not serve, and this copies it out, making
//! the directory first, and prints its WAT beside it with `wasmprinter`.
//!
//! `nanvm-demos-publish <built .wasm> <published .wasm> <published .wat>`

use std::{env, fs, io, path::Path, process::ExitCode};

/// Makes `path`'s directory.
fn make_directory(path: &Path) -> io::Result<()> {
    match path.parent() {
        Some(directory) => fs::create_dir_all(directory),
        None => Ok(()),
    }
}

/// The WAT of a module, or why there is none.
fn wat(bytes: &[u8]) -> Result<String, String> {
    wasmprinter::print_bytes(bytes).map_err(|e| e.to_string())
}

/// Copies `from` to `to`, and writes its WAT to `wat_to`, making each
/// directory first.
fn publish(from: &Path, to: &Path, wat_to: &Path) -> Result<(), String> {
    let bytes = fs::read(from).map_err(|e| format!("{}: {e}", from.display()))?;
    let text = wat(&bytes).map_err(|e| format!("{}: {e}", from.display()))?;
    for (path, contents) in [(to, bytes.as_slice()), (wat_to, text.as_bytes())] {
        make_directory(path)
            .and_then(|()| fs::write(path, contents))
            .map_err(|e| format!("{}: {e}", path.display()))?;
    }
    Ok(())
}

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();
    let [from, to, wat_to] = args.as_slice() else {
        eprintln!("usage: nanvm-demos-publish <built .wasm> <published .wasm> <published .wat>");
        return ExitCode::FAILURE;
    };
    match publish(Path::new(from), Path::new(to), Path::new(wat_to)) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The smallest module: the magic number and the version.
    const EMPTY: &[u8] = b"\0asm\x01\0\0\0";

    #[test]
    fn wat_prints_a_module() {
        assert_eq!(wat(EMPTY).unwrap().trim(), "(module)");
    }

    #[test]
    fn wat_refuses_what_is_not_a_module() {
        assert!(wat(b"\0asm").is_err());
    }

    /// Against a real directory, which a WebAssembly host does not give a
    /// test.
    #[cfg(not(target_family = "wasm"))]
    #[test]
    fn publish_makes_the_directories_and_writes_both() {
        let root = env::temp_dir().join(format!("nanvm-demos-publish-{}", std::process::id()));
        let from = root.join("built.wasm");
        let to = root.join("a/published.wasm");
        let wat_to = root.join("b/published.wat");
        fs::create_dir_all(&root).unwrap();
        fs::write(&from, EMPTY).unwrap();
        publish(&from, &to, &wat_to).unwrap();
        assert_eq!(fs::read(&to).unwrap(), EMPTY);
        assert_eq!(fs::read_to_string(&wat_to).unwrap().trim(), "(module)");
        fs::remove_dir_all(&root).unwrap();
    }

    /// Relative paths, which every host the tests run on can resolve; the
    /// read fails before anything is written.
    #[test]
    fn publish_refuses_a_missing_module() {
        let to = Path::new("never-written.wasm");
        assert!(
            publish(
                Path::new("missing.wasm"),
                to,
                Path::new("never-written.wat")
            )
            .is_err()
        );
        assert!(!to.exists());
    }
}
