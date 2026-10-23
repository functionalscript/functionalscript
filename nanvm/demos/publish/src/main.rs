//! Puts the WASM demo pages' module where the site serves it
//! (`todo/wasm-demos.md`), with each sample's disassembly. The deployment
//! build runs it after building `nanvm-demos` for `wasm32`: `cargo` writes the
//! module under `target/`, which the site does not serve, and this copies it
//! out, making the directory first, and prints each sample's WAT beside it
//! with `wasmprinter`.
//!
//! A sample's WAT holds only the functions Rust defines in its module,
//! `nanvm_demos::samples::<sample>`, picked by the names in the module's name
//! section, which this demangles first so the WAT names every function as
//! Rust does: NaNVM and `std` are most of the module and the same for every
//! sample.
//!
//! `nanvm-demos-publish <built .wasm> <published .wasm> <WAT directory> <sample>...`

use std::{env, fs, io, ops::Range, path::Path, process::ExitCode};
use wasmparser::{BinaryReader, KnownCustom, Name, NameMap, Parser, Payload, TypeRef};

/// Makes `path`'s directory.
fn make_directory(path: &Path) -> io::Result<()> {
    match path.parent() {
        Some(directory) => fs::create_dir_all(directory),
        None => Ok(()),
    }
}

/// Appends `value` in unsigned LEB128, as WebAssembly writes sizes.
fn leb128(out: &mut Vec<u8>, mut value: usize) {
    loop {
        let byte = (value & 0x7f) as u8;
        value >>= 7;
        if value == 0 {
            out.push(byte);
            return;
        }
        out.push(byte | 0x80);
    }
}

/// Appends a section, or a name subsection: its id, its size and `content`.
fn section(out: &mut Vec<u8>, id: u8, content: &[u8]) {
    out.push(id);
    leb128(out, content.len());
    out.extend(content);
}

/// Appends a name, as WebAssembly writes one: its size, then its UTF-8.
fn name(out: &mut Vec<u8>, text: &str) {
    leb128(out, text.len());
    out.extend(text.as_bytes());
}

/// The contents of a name section, with each function's name demangled and
/// every other subsection as it was.
fn demangled_names(data: &[u8], offset: u64) -> wasmparser::Result<Vec<u8>> {
    let mut out = Vec::new();
    name(&mut out, "name");
    let mut reader = BinaryReader::new(data, offset);
    while !reader.eof() {
        let id = reader.read_u8()?;
        let size = reader.read_var_u32()? as usize;
        let start = reader.original_position();
        let content = reader.read_bytes(size)?;
        if id != FUNCTION_NAMES {
            section(&mut out, id, content);
            continue;
        }
        let functions = NameMap::new(BinaryReader::new(content, start))?
            .collect::<wasmparser::Result<Vec<_>>>()?;
        let mut map = Vec::new();
        leb128(&mut map, functions.len());
        for naming in functions {
            leb128(&mut map, naming.index as usize);
            name(
                &mut map,
                &format!("{:#}", rustc_demangle::demangle(naming.name)),
            );
        }
        section(&mut out, id, &map);
    }
    Ok(out)
}

/// The id of the name section's function names subsection.
const FUNCTION_NAMES: u8 = 1;

/// The module with its functions named as Rust writes them,
/// `nanvm_demos::samples::hello::module::<…>`, instead of by their mangled
/// symbols. Every other section is copied as it was.
fn demangle(bytes: &[u8]) -> wasmparser::Result<Vec<u8>> {
    let mut out = Vec::new();
    for payload in Parser::new(0).parse_all(bytes) {
        let payload = payload?;
        if let Payload::Version { range, .. } = &payload {
            out.extend(&bytes[range.start as usize..range.end as usize]);
        }
        let Some((id, range)) = payload.as_section() else {
            continue;
        };
        let content = &bytes[range.start as usize..range.end as usize];
        match payload {
            Payload::CustomSection(custom) if custom.name() == "name" => {
                let names = demangled_names(custom.data(), custom.data_offset())?;
                section(&mut out, id, &names);
            }
            _ => section(&mut out, id, content),
        }
    }
    Ok(out)
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

/// The WAT of the functions defined in `sample`'s module, by their demangled
/// names, or why there is none. A line belongs to a function when its binary
/// offset is in the function's body; a line with no offset belongs to the
/// line before it.
fn wat(bytes: &[u8], sample: &str) -> Result<String, String> {
    let bytes = demangle(bytes).map_err(|e| e.to_string())?;
    let path = format!("nanvm_demos::samples::{sample}::");
    let kept = bodies(&bytes, |name| name.contains(&path)).map_err(|e| e.to_string())?;
    if kept.is_empty() {
        return Err(format!("no functions of the sample `{sample}`"));
    }
    let mut storage = String::new();
    let lines = wasmprinter::Config::new()
        .offsets_and_lines(&bytes, &mut storage)
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

/// Removes each `.wat` in `wat_to` that names none of `samples`, so a sample
/// removed or renamed leaves no disassembly behind for the site to serve, or
/// for the committed directory's drift check to miss.
fn remove_stale(wat_to: &Path, samples: &[String]) -> io::Result<()> {
    for entry in fs::read_dir(wat_to)? {
        let path = entry?.path();
        let stale = path.extension().is_some_and(|e| e == "wat")
            && path
                .file_stem()
                .and_then(|s| s.to_str())
                .is_none_or(|s| !samples.iter().any(|n| n == s));
        if stale {
            fs::remove_file(&path)?;
        }
    }
    Ok(())
}

/// Copies `from` to `to`, and writes each sample's WAT to `<sample>.wat` in
/// `wat_to`, making each directory first, then removes any other WAT there.
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
    remove_stale(wat_to, samples).map_err(|e| format!("{}: {e}", wat_to.display()))
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
        assert!(text.contains("nanvm_demos::samples::hello::module"));
        assert!(!text.contains(SAMPLE));
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
        fs::create_dir_all(&wat_to).unwrap();
        fs::write(&from, &module).unwrap();
        // A removed sample's WAT, and a file that is no WAT.
        fs::write(wat_to.join("gone.wat"), "").unwrap();
        fs::write(wat_to.join("notes.txt"), "").unwrap();
        publish(&from, &to, &wat_to, &["hello".to_string()]).unwrap();
        assert_eq!(fs::read(&to).unwrap(), module);
        assert!(!wat_to.join("gone.wat").exists());
        assert!(wat_to.join("notes.txt").exists());
        assert!(
            fs::read_to_string(wat_to.join("hello.wat"))
                .unwrap()
                .contains("nanvm_demos::samples::hello::module")
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
