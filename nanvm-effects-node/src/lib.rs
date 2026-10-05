//! The native runner of the `fjs/effects/node` operations, the Rust twin of
//! `fjs/effects/node/module.mjs` (`todo/nanvm-effects-node.md`,
//! `nanvm-lib/todo/mvp-roadmap.md`).
//!
//! `nanvm-lib` stays pure; this crate is where a program meets the operating
//! system. The operations' types and the [`Operations`] trait, one method per
//! operation a runner implements, are generated from the RTTI schemas in
//! `fjs/effects/schema` and committed as `gen.operations.rs` (a `gen.` name is
//! never a Rust identifier, so one `#[path]` names it), so rustc checks a
//! runner's coverage and signatures against the schemas.
//!
//! An operation whose request or result is not data, `sandbox` and the others
//! the audit in `todo/nanvm-effects-node.md` lists, is handwritten and not
//! part of the generated trait.

#[path = "gen.operations.rs"]
mod operations;

/// The dispatch over the generated operations: `gen.dispatch.rs`.
#[path = "gen.dispatch.rs"]
mod dispatch;

mod codec;
mod native;

pub use codec::*;

pub use dispatch::dispatch;
pub use native::{MAX_FILE_SIZE_BYTES, Native, normalize};
pub use operations::*;

/// A runner that implements nothing: every operation answers
/// `NotImplemented` with its own name, as a runner without a handler does.
/// The base a runner starts from, and what proves the trait is implementable
/// in full.
#[derive(Debug, Default, Clone, Copy)]
pub struct Unimplemented;

fn not_implemented<T>(name: &str) -> Result<T, IoChannel> {
    Err(IoChannel::NotImplemented(name.to_string()))
}

impl Operations for Unimplemented {
    fn mkdir(&mut self, _: String, _: Option<MakeDirectoryOptions>) -> Result<(), IoChannel> {
        not_implemented("mkdir")
    }
    fn read_file(&mut self, _: String) -> Result<Vec<u8>, IoChannel> {
        not_implemented("readFile")
    }
    fn resolve_file_module(
        &mut self,
        _: String,
        _: Option<String>,
    ) -> Result<FileModule, IoChannel> {
        not_implemented("resolveFileModule")
    }
    fn readdir(&mut self, _: String, _: ReaddirOptions) -> Result<Vec<Dirent>, IoChannel> {
        not_implemented("readdir")
    }
    fn write_file(&mut self, _: String, _: Vec<u8>) -> Result<(), IoChannel> {
        not_implemented("writeFile")
    }
    fn write_bytes(&mut self, _: String, _: f64, _: Vec<u8>) -> Result<(), IoChannel> {
        not_implemented("writeBytes")
    }
    fn rm(&mut self, _: String) -> Result<(), IoChannel> {
        not_implemented("rm")
    }
    fn write(&mut self, _: WriteConsoles, _: Vec<u8>) -> Result<(), NotImplemented> {
        Err(NotImplemented("write".to_string()))
    }
    fn read(&mut self) -> Result<Option<f64>, NotImplemented> {
        Err(NotImplemented("read".to_string()))
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn every_operation_is_unimplemented() {
        let mut r = Unimplemented;
        assert_eq!(r.mkdir("a".into(), None), not_implemented("mkdir"));
        assert_eq!(r.read_file("a".into()), not_implemented("readFile"));
        assert_eq!(
            r.resolve_file_module("a".into(), None),
            not_implemented("resolveFileModule")
        );
        assert_eq!(
            r.readdir("a".into(), ReaddirOptions { recursive: false }),
            not_implemented("readdir")
        );
        assert_eq!(
            r.write_file("a".into(), vec![]),
            not_implemented("writeFile")
        );
        assert_eq!(
            r.write_bytes("a".into(), 0.0, vec![]),
            not_implemented("writeBytes")
        );
        assert_eq!(r.rm("a".into()), not_implemented("rm"));
        assert_eq!(
            r.write(WriteConsoles::Stdout, vec![]),
            Err(NotImplemented("write".to_string()))
        );
        assert_eq!(r.read(), Err(NotImplemented("read".to_string())));
    }
}

#[cfg(test)]
mod test_dispatch {
    use super::*;
    use nanvm_lib::{
        naive::Naive,
        vm::{
            Any, Array, Nullish, ToAny, ToObject,
            unstable::{f64_any, string_any, string_key},
        },
    };
    use std::io::Cursor;

    type V = Any<Naive>;

    fn parts(any: V) -> Vec<V> {
        Array::try_from(any).unwrap().into_iter().collect()
    }

    fn tuple(tag: &str, items: Vec<V>) -> Vec<V> {
        let mut all = vec![string_any(tag)];
        all.extend(items);
        all
    }

    fn object(members: Vec<(&str, V)>) -> V {
        members
            .into_iter()
            .map(|(k, v)| (string_key::<Naive>(k), v))
            .collect::<Vec<_>>()
            .to_object()
            .to_any()
    }

    fn run<R: Operations>(r: &mut R, command: &str, payload: &[V]) -> Vec<V> {
        parts(dispatch(r, command, payload).unwrap().unwrap())
    }

    /// An operation the runner lacks answers `['error', ['notImplemented', name]]`.
    #[test]
    fn an_unimplemented_operation() {
        let answer = run(&mut Unimplemented, "readFile", &[string_any("a")]);
        assert_eq!(answer[0], string_any("error"));
        assert_eq!(
            parts(answer[1].clone()),
            tuple("notImplemented", vec![string_any("readFile")])
        );
        let answer = run(&mut Unimplemented, "read", &[string_any("stdin")]);
        assert_eq!(answer[0], string_any("error"));
        assert_eq!(
            parts(answer[1].clone()),
            tuple("notImplemented", vec![string_any("read")])
        );
    }

    /// What this runner has no operation for is `None`; a request that is not one is `Malformed`.
    #[test]
    fn unknown_and_malformed() {
        assert!(dispatch::<Naive, _>(&mut Unimplemented, "sandbox", &[]).is_none());
        assert!(dispatch::<Naive, _>(&mut Unimplemented, "constructor", &[]).is_none());
        let malformed =
            |command: &str, payload: &[V]| dispatch(&mut Unimplemented, command, payload).unwrap();
        assert_eq!(
            malformed("readFile", &[]),
            Err(Malformed("missing argument 0, `path`".into()))
        );
        assert_eq!(
            malformed("readFile", &[f64_any(0)]),
            Err(Malformed("not a string".into()))
        );
        assert!(
            malformed(
                "mkdir",
                &[string_any("a"), object(vec![("recursive", false.to_any())])]
            )
            .is_err()
        );
        assert!(
            malformed(
                "mkdir",
                &[string_any("a"), object(vec![("x", true.to_any())])]
            )
            .is_err()
        );
        assert!(malformed("write", &[string_any("stdin"), f64_any(0)]).is_err());
        assert!(malformed("read", &[string_any("stdout")]).is_err());
    }

    /// An optional argument may be left out, or `undefined`, or given.
    #[test]
    fn optional_arguments() {
        let given = object(vec![("recursive", true.to_any())]);
        let undefined: V = Nullish::Undefined.to_any();
        for payload in [
            vec![string_any("a")],
            vec![string_any("a"), undefined],
            vec![string_any("a"), given],
        ] {
            assert_eq!(
                run(&mut Unimplemented, "mkdir", &payload)[0],
                string_any("error")
            );
        }
        let null: V = Nullish::Null.to_any();
        assert_eq!(
            run(
                &mut Unimplemented,
                "resolveFileModule",
                &[string_any("a"), null]
            )[0],
            string_any("error")
        );
        assert!(
            dispatch(
                &mut Unimplemented,
                "resolveFileModule",
                &[string_any("a"), Nullish::Undefined.to_any::<Naive>()]
            )
            .unwrap()
            .is_err()
        );
    }

    /// The console, through the dispatch: bytes as the language's bit vectors.
    #[test]
    fn the_console() {
        let mut r = Native::new(Cursor::new(b"a".to_vec()), Vec::new(), Vec::new());
        let bytes = encode_bytes::<Naive>(b"hi".to_vec());
        assert_eq!(
            run(&mut r, "write", &[string_any("stdout"), bytes.clone()]),
            vec![string_any("ok"), Nullish::Undefined.to_any()]
        );
        assert_eq!(
            run(&mut r, "write", &[string_any("stderr"), bytes]).len(),
            2
        );
        assert!(
            dispatch(
                &mut r,
                "write",
                &[string_any("stdin"), encode_bytes::<Naive>(vec![])]
            )
            .unwrap()
            .is_err()
        );
        assert_eq!(
            run(&mut r, "read", &[string_any("stdin")]),
            vec![string_any("ok"), f64_any(0x4058400000000000)]
        );
        assert_eq!(
            run(&mut r, "read", &[string_any("stdin")]),
            vec![string_any("ok"), Nullish::Null.to_any()]
        );
        assert_eq!(
            (r.stdout().as_slice(), r.stderr().as_slice()),
            (&b"hi"[..], &b"hi"[..])
        );
    }

    /// Files, through the dispatch against a real directory.
    #[cfg(not(target_family = "wasm"))]
    #[test]
    fn files() {
        let dir = std::env::temp_dir().join(format!(
            "nanvm-effects-node-dispatch-{}",
            std::process::id()
        ));
        let at = |name: &str| string_any::<Naive>(&dir.join(name).to_string_lossy());
        let mut r = Native::new(Cursor::new(vec![]), Vec::new(), Vec::new());
        let recursive = object(vec![("recursive", true.to_any())]);
        assert_eq!(
            run(
                &mut r,
                "mkdir",
                &[string_any(&dir.to_string_lossy()), recursive]
            )[0],
            string_any("ok")
        );
        let bytes = encode_bytes::<Naive>(vec![0, 1, 2, 255]);
        assert_eq!(
            run(&mut r, "writeFile", &[at("a"), bytes.clone()])[0],
            string_any("ok")
        );
        let read = run(&mut r, "readFile", &[at("a")]);
        assert_eq!(read, vec![string_any("ok"), bytes]);
        assert_eq!(decode_bytes(read[1].clone()), Ok(vec![0, 1, 2, 255]));
        let patch = encode_bytes::<Naive>(vec![9]);
        assert_eq!(
            run(
                &mut r,
                "writeBytes",
                &[at("a"), f64_any(0x3ff0000000000000), patch]
            )[0],
            string_any("ok")
        );
        assert_eq!(
            decode_bytes(run(&mut r, "readFile", &[at("a")])[1].clone()),
            Ok(vec![0, 9, 2, 255])
        );
        let listing = run(
            &mut r,
            "readdir",
            &[string_any(&dir.to_string_lossy()), object(vec![])],
        );
        assert_eq!(listing[0], string_any("ok"));
        let entries = parts(listing[1].clone());
        assert_eq!(entries.len(), 1);
        let entry = nanvm_lib::vm::Object::try_from(entries[0].clone()).unwrap();
        assert_eq!(
            entry.own_property(&string_key("name")),
            Some(string_any("a"))
        );
        assert_eq!(
            entry.own_property(&string_key("isFile")),
            Some(true.to_any())
        );
        assert_eq!(run(&mut r, "rm", &[at("a")])[0], string_any("ok"));
        let missing = run(&mut r, "readFile", &[at("a")]);
        assert_eq!(missing[0], string_any("error"));
        let failure = parts(missing[1].clone());
        assert_eq!(failure[0], string_any("ioError"));
        let info = nanvm_lib::vm::Object::try_from(failure[1].clone()).unwrap();
        assert_eq!(
            info.own_property(&string_key("code")),
            Some(string_any("ENOENT"))
        );
        assert!(info.own_property(&string_key("message")).is_some());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
