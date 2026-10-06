//! The native runner of the `fjs/effects/node` operations, the Rust twin of
//! `fjs/effects/node/module.mjs` (`todo/nanvm-effects-node.md`,
//! `nanvm-lib/todo/mvp-roadmap.md`).
//!
//! `nanvm-lib` stays pure; this crate depends on it and is where a program
//! meets the operating system. `bigint` is `nanvm_lib::vm::BigInt<A>`, so the
//! trait is generic over the VM `A`. The operations' types and the [`Operations`] trait, one method per
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

pub use nanvm_lib::vm::{BigInt, IVm};
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

impl<A: IVm> Operations<A> for Unimplemented {
    fn mkdir(&mut self, _: String, _: Option<MakeDirectoryOptions>) -> Result<(), IoChannel> {
        not_implemented("mkdir")
    }
    fn read_file(&mut self, _: String) -> Result<BigInt<A>, IoChannel> {
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
    fn write_file(&mut self, _: String, _: BigInt<A>) -> Result<(), IoChannel> {
        not_implemented("writeFile")
    }
    fn write_bytes(&mut self, _: String, _: f64, _: BigInt<A>) -> Result<(), IoChannel> {
        not_implemented("writeBytes")
    }
    fn rm(&mut self, _: String) -> Result<(), IoChannel> {
        not_implemented("rm")
    }
    fn write(&mut self, _: WriteConsoles, _: BigInt<A>) -> Result<(), NotImplemented> {
        Err(NotImplemented("write".to_string()))
    }
    fn read(&mut self) -> Result<Option<f64>, NotImplemented> {
        Err(NotImplemented("read".to_string()))
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use nanvm_lib::naive::Naive;

    fn unimplemented<T>(r: Result<T, IoChannel>, name: &str) {
        assert!(matches!(r, Err(IoChannel::NotImplemented(n)) if n == name));
    }

    fn data() -> BigInt<Naive> {
        BigInt::default()
    }

    #[test]
    fn every_operation_is_unimplemented() {
        let mut r = Unimplemented;
        unimplemented(
            Operations::<Naive>::mkdir(&mut r, "a".into(), None),
            "mkdir",
        );
        unimplemented(
            Operations::<Naive>::read_file(&mut r, "a".into()),
            "readFile",
        );
        unimplemented(
            Operations::<Naive>::resolve_file_module(&mut r, "a".into(), None),
            "resolveFileModule",
        );
        unimplemented(
            Operations::<Naive>::readdir(&mut r, "a".into(), ReaddirOptions { recursive: false }),
            "readdir",
        );
        unimplemented(
            Operations::<Naive>::write_file(&mut r, "a".into(), data()),
            "writeFile",
        );
        unimplemented(
            Operations::<Naive>::write_bytes(&mut r, "a".into(), 0.0, data()),
            "writeBytes",
        );
        unimplemented(Operations::<Naive>::rm(&mut r, "a".into()), "rm");
        assert_eq!(
            Operations::<Naive>::write(&mut r, WriteConsoles::Stdout, data()),
            Err(NotImplemented("write".to_string()))
        );
        assert_eq!(
            Operations::<Naive>::read(&mut r),
            Err(NotImplemented("read".to_string()))
        );
    }
}
