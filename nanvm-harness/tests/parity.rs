//! The native host against the Node one. `fixtures/parity.mjs` holds programs
//! that do file operations inside a directory they are given and answer what
//! each returned; they are performed here by `nanvm-effects-node` and by the
//! Node runner in `fjs/nanvm/parity/proof.mjs`, and both must answer the
//! `expected` each case carries.

#[cfg(not(target_family = "wasm"))]
mod host {
    use nanvm_effects_node::{Native, run};
    use nanvm_harness::fixtures::parity;
    use nanvm_lib::{
        common::sized_index::SizedIndex,
        naive::Naive,
        vm::{Any, Array, Function, Object, ToArray, unstable::string_any},
    };
    use std::{fs, io::Cursor, path::PathBuf};

    type V = Any<Naive>;

    fn member(object: &Object<Naive>, name: &str) -> V {
        object.own_property(&name.into()).unwrap()
    }

    /// The names of the module's exports, which are the cases.
    fn names(exports: &Object<Naive>) -> Vec<String> {
        exports
            .own_entries()
            .into_iter()
            .map(|(key, _)| {
                let text = key;
                let units: Vec<u16> = (0..text.length()).map(|i| text[i]).collect();
                String::from_utf16_lossy(&units)
            })
            .collect()
    }

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
        let exports = Object::try_from(parity::module::<Naive>().unwrap()).unwrap();
        let cases = names(&exports);
        assert!(!cases.is_empty());
        for case in cases {
            let object = Object::try_from(member(&exports, &case)).unwrap();
            let directory = Scratch::new(&case);
            let root = string_any(&directory.0.to_string_lossy());
            let effect = Function::try_from(member(&object, "run"))
                .unwrap()
                .call([root].to_array())
                .unwrap();
            let mut host = Native::new(Cursor::new(Vec::new()), Vec::new(), Vec::new());
            let result = run(effect, |command, payload| host.perform(command, payload))
                .unwrap_or_else(|thrown| panic!("{case} threw {thrown:?}"));
            let [tag, answers]: [V; 2] = Array::try_from(result)
                .unwrap()
                .into_iter()
                .collect::<Vec<_>>()
                .try_into()
                .unwrap();
            assert_eq!(tag, string_any("ok"), "{case}");
            assert_eq!(
                answers.to_json().unwrap(),
                member(&object, "expected").to_json().unwrap(),
                "{case}"
            );
        }
    }
}
