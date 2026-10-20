//! The native host against the Node one. `fixtures/parity.mjs` holds programs
//! that do file operations inside a directory they are given and answer what
//! each returned; they are performed here by `nanvm-effects-node` and by the
//! Node runner in `fjs/nanvm/parity/proof.mjs`, and both must answer the
//! `expected` each case carries.

#[cfg(not(target_family = "wasm"))]
mod common;

#[cfg(not(target_family = "wasm"))]
mod host {
    use super::common::{member, names, perform_case};
    use nanvm_effects_node::Native;
    use nanvm_harness::{fixtures::parity, runtime};
    use nanvm_lib::{
        naive::Naive,
        vm::{Object, ToArray, unstable::string_any},
    };
    use std::{fs, io::Cursor, path::PathBuf};

    /// A fresh directory under the system's, removed when dropped.
    struct Scratch(PathBuf);

    impl Scratch {
        fn new(case: &str) -> Self {
            let path =
                std::env::temp_dir().join(format!("nanvm-parity-{}-{case}", std::process::id()));
            let _ = fs::remove_dir_all(&path);
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    /// Every case answers what it expects. A WebAssembly host has no
    /// directory to give a test.
    #[test]
    fn the_native_host_answers_what_the_cases_expect() {
        let exports = Object::try_from(parity::module::<Naive>(runtime()).unwrap()).unwrap();
        let cases = names(&exports);
        assert!(!cases.is_empty());
        for case in cases {
            let object = Object::try_from(member(&exports, &case)).unwrap();
            let directory = Scratch::new(&case);
            let root = string_any(&directory.0.to_string_lossy());
            let mut host = Native::new(Cursor::new(Vec::new()), Vec::new(), Vec::new());
            perform_case(&case, &object, [root].to_array(), &mut host);
        }
    }
}
