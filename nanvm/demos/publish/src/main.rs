//! Puts the WASM demo pages' module where the site serves it
//! (`todo/wasm-demos.md`), with each sample's disassembly. The deployment
//! build runs it after building `nanvm-demos` for `wasm32`: `cargo` writes the
//! module under `target/`, which the site does not serve, and this copies it
//! out, making the directory first, and prints each sample's WAT beside it
//! with `wasmprinter`.
//!
//! A sample's WAT holds only the functions Rust defines in its module,
//! `nanvm_demos::samples::<sample>`, by their demangled names in the module's
//! name section: NaNVM and `std` are most of the module and the same for
//! every sample.
//!
//! `nanvm-demos-publish <built .wasm> <published .wasm> <WAT directory> <sample>...`

use std::{env, fs, io, ops::Range, path::Path, process::ExitCode};
use wasmparser::{KnownCustom, Name, Parser, Payload, TypeRef};

/// Makes `path`'s directory.
fn make_directory(path: &Path) -> io::Result<()> {
    match path.parent() {
        Some(directory) => fs::create_dir_all(directory),
        None => Ok(()),
    }
}

/// The byte ranges of the bodies of the functions whose names `keep` accepts,
/// in the order the module defines them.
fn bodies(bytes: &[u8], keep: impl Fn(&str) -> bool) -> wasmparser::Result<Vec<Range<u64>>> {
    let mut imported = 0;
    let mut defined = Vec::new();
    let mut kept = Vec::new();
    for payload in Parser::new(0).parse_all(bytes) {
        match payload? {
            Payload::ImportSection(imports) => {
                for import in imports.into_imports() {
                    if matches!(import?.ty, TypeRef::Func(_) | TypeRef::FuncExact(_)) {
                        imported += 1;
                    }
                }
            }
            Payload::CodeSectionEntry(body) => defined.push(body.range()),
            Payload::CustomSection(custom) => {
                if let KnownCustom::Name(names) = custom.as_known() {
                    for name in names {
                        if let Name::Function(functions) = name? {
                            for naming in functions {
                                let naming = naming?;
                                if keep(naming.name) {
                                    kept.push(naming.index);
                                }
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }
    Ok(kept
        .into_iter()
        .filter_map(|index| index.checked_sub(imported))
        .filter_map(|index| defined.get(index as usize).cloned())
        .collect())
}

/// Whether `symbol` is defined in `sample`'s module.
fn in_sample(sample: &str) -> impl Fn(&str) -> bool {
    let path = format!("nanvm_demos::samples::{sample}::");
    move |symbol| format!("{:#}", rustc_demangle::demangle(symbol)).contains(&path)
}

/// The WAT of the functions defined in `sample`'s module, or why there is
/// none. A line belongs to a function when its binary offset is in the
/// function's body; a line with no offset belongs to the line before it.
fn wat(bytes: &[u8], sample: &str) -> Result<String, String> {
    let kept = bodies(bytes, in_sample(sample)).map_err(|e| e.to_string())?;
    if kept.is_empty() {
        return Err(format!("no functions of the sample `{sample}`"));
    }
    let mut storage = String::new();
    let lines = wasmprinter::Config::new()
        .offsets_and_lines(bytes, &mut storage)
        .map_err(|e| e.to_string())?;
    let mut text = String::new();
    let mut keeping = false;
    for (offset, line) in lines {
        if let Some(offset) = offset {
            keeping = kept.iter().any(|body| body.contains(&offset));
        }
        if keeping {
            text.push_str(line);
        }
    }
    Ok(text)
}

/// Copies `from` to `to`, and writes each sample's WAT to `<sample>.wat` in
/// `wat_to`, making each directory first.
fn publish(from: &Path, to: &Path, wat_to: &Path, samples: &[String]) -> Result<(), String> {
    let bytes = fs::read(from).map_err(|e| format!("{}: {e}", from.display()))?;
    let mut files = vec![(to.to_path_buf(), bytes.clone())];
    for sample in samples {
        let text = wat(&bytes, sample).map_err(|e| format!("{}: {e}", from.display()))?;
        files.push((wat_to.join(format!("{sample}.wat")), text.into_bytes()));
    }
    for (path, contents) in files {
        make_directory(&path)
            .and_then(|()| fs::write(&path, contents))
            .map_err(|e| format!("{}: {e}", path.display()))?;
    }
    Ok(())
}

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();
    let [from, to, wat_to, samples @ ..] = args.as_slice() else {
        eprintln!(
            "usage: nanvm-demos-publish <built .wasm> <published .wasm> <WAT directory> <sample>..."
        );
        return ExitCode::FAILURE;
    };
    match publish(Path::new(from), Path::new(to), Path::new(wat_to), samples) {
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

    /// A module importing one function and defining two, named in its name
    /// section: `$hi` with v0 mangling inside `nanvm_demos::samples::hello`,
    /// and `$other` outside it. `wat::parse_str` would write it, but is not a
    /// dependency.
    const MODULE: &[u8] = &[
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // magic, version
        0x01, 0x04, 0x01, 0x60, 0x00, 0x00, // type section: () -> ()
        0x02, 0x07, 0x01, 0x01, b'm', 0x01, b'f', 0x00, 0x00, // import m.f
        0x03, 0x03, 0x02, 0x00, 0x00, // function section: two of type 0
        0x0a, 0x08, 0x02, // code section, two bodies:
        0x02, 0x00, 0x0b, // no locals, end
        0x03, 0x00, 0x01, 0x0b, // no locals, nop, end
    ];

    /// `MODULE` with its name section, naming function 1 `name1` and
    /// function 2 `name2`.
    fn named(name1: &str, name2: &str) -> Vec<u8> {
        let mut map = vec![0x02];
        for (index, name) in [(1, name1), (2, name2)] {
            map.extend([index, name.len() as u8]);
            map.extend(name.as_bytes());
        }
        let mut contents = vec![0x04];
        contents.extend(b"name");
        contents.extend([0x01, map.len() as u8]);
        contents.extend(map);
        let mut module = MODULE.to_vec();
        module.extend([0x00, contents.len() as u8]);
        module.extend(contents);
        module
    }

    /// `nanvm_demos::samples::hello::module` in v0 mangling.
    const SAMPLE: &str = "_RNvNtNtCs1234_11nanvm_demos7samples5hello6module";

    #[test]
    fn wat_prints_the_sample_alone() {
        let text = wat(&named("other", SAMPLE), "hello").unwrap();
        assert!(text.contains(SAMPLE));
        assert!(text.contains("nop"));
        assert!(!text.contains("other"));
        assert!(!text.contains("(import"));
    }

    #[test]
    fn wat_refuses_a_sample_with_no_functions() {
        assert!(wat(&named("other", SAMPLE), "goodbye").is_err());
    }

    #[test]
    fn wat_refuses_what_is_not_a_module() {
        assert!(wat(b"\0asm", "hello").is_err());
    }

    /// Against a real directory, which a WebAssembly host does not give a
    /// test.
    #[cfg(not(target_family = "wasm"))]
    #[test]
    fn publish_makes_the_directories_and_writes_each() {
        let root = env::temp_dir().join(format!("nanvm-demos-publish-{}", std::process::id()));
        let from = root.join("built.wasm");
        let to = root.join("a/published.wasm");
        let wat_to = root.join("b");
        let module = named("other", SAMPLE);
        fs::create_dir_all(&root).unwrap();
        fs::write(&from, &module).unwrap();
        publish(&from, &to, &wat_to, &["hello".to_string()]).unwrap();
        assert_eq!(fs::read(&to).unwrap(), module);
        assert!(
            fs::read_to_string(wat_to.join("hello.wat"))
                .unwrap()
                .contains(SAMPLE)
        );
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
                Path::new("never-written"),
                &["hello".to_string()]
            )
            .is_err()
        );
        assert!(!to.exists());
    }
}
