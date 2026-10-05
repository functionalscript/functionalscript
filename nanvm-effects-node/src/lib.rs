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
