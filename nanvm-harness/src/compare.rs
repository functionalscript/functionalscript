//! A compiled fixture against its generated expectation (`gen.expected/`),
//! the comparison of Stage 8 step 2 in
//! `nanvm-lib/todo/callable-function-objects.md`.
//!
//! The expectation is the FunctionalScript interpreter's value for the same
//! source, proved equal to Node's by `fjs/nanvm/corpus`. It has two layers
//! that fail independently, and [`check`] runs both:
//!
//! 1. *The JSON bytes.* The text `Any::to_json` gives the compiled default,
//!    against the bytes the compiler's own JSON writer produced. That path
//!    shares nothing with the Rust literal emitter that spelled the compiled
//!    fixture, and JSON text is ordered, so a wrong property order fails
//!    here.
//! 2. *The graph.* The compiled result against the expectation module the
//!    interpreter's value was printed into: [`same_graph`].
//!
//! Neither layer runs the program's logic in Rust; the program reached Rust by
//! compiling its source. The leaves the shared emitter could spell wrongly
//! in both operands at once (`undefined`, `bigint`, `-0`, non-finite
//! numbers) keep a hand-written assertion in `lib.rs`.

use nanvm_lib::{
    common::sized_index::SizedIndex,
    naive::Naive,
    vm::{Any, IVm, Nullish, Object, ToAny, Unpacked},
};

/// A corpus fixture and what it is expected to be, one row of the generated
/// `gen.expected/mod.rs`.
pub struct Case {
    /// The fixture's Rust module name.
    pub name: &'static str,
    /// The compiled fixture's `module`.
    pub fixture: fn() -> Result<Any<Naive>, Any<Naive>>,
    /// The expectation's `module`: the interpreter's value as a graph, or the
    /// throw it ended in.
    pub expected: fn() -> Result<Any<Naive>, Any<Naive>>,
    /// The UTF-8 bytes of the default's JSON text, where it has a JSON form.
    pub json: Option<&'static [u8]>,
    /// Whether the fixture is expected to throw while it initializes.
    pub throws: bool,
}

/// Whether two graphs are the same value, and, where they are not, the first
/// difference found, with the path to it.
///
/// Leaves compare as `Object.is` does, numbers by their bits (`NaN`, `-0`),
/// everything else by `==`. Arrays compare by their elements. Objects compare
/// by their [`Object::own_entries`], pairwise and in order, so a duplicated
/// raw slot (an object spread's overwrite) equals the interpreter's
/// normalized object while the right entries in the wrong observable order
/// still fail.
///
/// Sharing is compared too: the two graphs are walked together, and an actual
/// container must map to exactly one expected container and the reverse, so
/// `[shared, shared]` is not two equal copies. `Any ==` is identity on a
/// container, so the pairs seen live in a list searched with it, and no hash
/// of an `Any` is needed.
pub fn same_graph<A: IVm>(actual: &Any<A>, expected: &Any<A>) -> Result<(), String> {
    Walk { pairs: Vec::new() }.walk("$", actual, expected)
}

struct Walk<A: IVm> {
    /// The container pairs entered so far: an actual container with the
    /// expected container it was matched to.
    pairs: Vec<(Any<A>, Any<A>)>,
}

impl<A: IVm> Walk<A> {
    fn walk(&mut self, path: &str, actual: &Any<A>, expected: &Any<A>) -> Result<(), String> {
        match (actual.clone().into(), expected.clone().into()) {
            (Unpacked::Number(a), Unpacked::Number(e)) => {
                let (a, e) = (f64::from(a), f64::from(e));
                if a.to_bits() == e.to_bits() {
                    Ok(())
                } else {
                    Err(format!("{path}: {a:?} is not {e:?}"))
                }
            }
            (Unpacked::Array(a), Unpacked::Array(e)) => {
                if self.entered(path, actual, expected)? {
                    return Ok(());
                }
                if a.length() != e.length() {
                    return Err(format!(
                        "{path}: length {} is not {}",
                        a.length(),
                        e.length()
                    ));
                }
                (0..a.length()).try_for_each(|i| self.walk(&format!("{path}[{i}]"), &a[i], &e[i]))
            }
            (Unpacked::Object(a), Unpacked::Object(e)) => {
                if self.entered(path, actual, expected)? {
                    return Ok(());
                }
                let (a, e) = (a.own_entries(), e.own_entries());
                if a.len() != e.len() {
                    return Err(format!("{path}: {} entries are not {}", a.len(), e.len()));
                }
                a.iter().zip(&e).try_for_each(|((ak, av), (ek, ev))| {
                    if ak == ek {
                        self.walk(&format!("{path}.{ak:?}"), av, ev)
                    } else {
                        Err(format!("{path}: key {ak:?} is not {ek:?}"))
                    }
                })
            }
            _ if actual == expected => Ok(()),
            _ => Err(format!("{path}: {actual:?} is not {expected:?}")),
        }
    }

    /// Whether this pair of containers was already entered. A container seen
    /// again must be seen against the same counterpart on both sides.
    fn entered(&mut self, path: &str, actual: &Any<A>, expected: &Any<A>) -> Result<bool, String> {
        match self
            .pairs
            .iter()
            .find(|(a, e)| a == actual || e == expected)
        {
            Some((a, e)) if a == actual && e == expected => Ok(true),
            Some(_) => Err(format!("{path}: sharing differs")),
            None => {
                self.pairs.push((actual.clone(), expected.clone()));
                Ok(false)
            }
        }
    }
}

/// The `default` export of a module's export object, `undefined` for a
/// module without one: the expectation is the interpreter's `read 'default'`,
/// which answers `undefined` for it.
fn default_of<A: IVm>(exports: Any<A>) -> Result<Any<A>, String> {
    let exports = Object::try_from(exports).map_err(|_| "the exports are not an object")?;
    Ok(exports
        .own_property(&"default".into())
        .unwrap_or(Nullish::Undefined.to_any()))
}

/// Runs both layers for one case: `Ok` when the compiled fixture is what its
/// expectation says, or the first difference.
///
/// Whether the fixture throws is the expectation's recorded `THROWS`, not
/// whether its module happens to throw too: a regression in the emitter both
/// share could make both throw. The thrown value, which is engine-specific,
/// is not compared.
pub fn check(case: &Case) -> Result<(), String> {
    match ((case.fixture)(), case.throws) {
        (Err(_), true) => Ok(()),
        (Err(thrown), false) => Err(format!("threw {thrown:?}, expected a value")),
        (Ok(value), true) => Err(format!("expected a throw, got {value:?}")),
        (Ok(actual), false) => {
            let expected = (case.expected)().map_err(|e| format!("the expectation threw {e:?}"))?;
            let (actual, expected) = (default_of(actual)?, default_of(expected)?);
            check_json(case.json, &actual)?;
            same_graph(&actual, &expected)
        }
    }
}

/// The JSON layer: the actual default's text is the expected bytes, or it has
/// no JSON form because the expectation has none.
fn check_json(json: Option<&[u8]>, actual: &Any<Naive>) -> Result<(), String> {
    match (json, actual.clone().to_json()) {
        (Some(bytes), Ok(text)) if text.as_bytes() == bytes => Ok(()),
        (Some(bytes), Ok(text)) => Err(format!(
            "JSON {text:?} is not {:?}",
            String::from_utf8_lossy(bytes)
        )),
        (Some(_), Err(e)) => Err(format!("expected JSON, got {e}")),
        (None, Err(_)) => Ok(()),
        (None, Ok(text)) => Err(format!("expected no JSON form, got {text:?}")),
    }
}

#[cfg(test)]
mod tests {
    use nanvm_lib::{
        naive::Naive,
        vm::{Any, ToAny, ToArray, ToObject},
    };

    use super::{Case, check, same_graph};

    type V = Any<Naive>;

    fn array(items: impl IntoIterator<Item = V>) -> V {
        items.into_iter().collect::<Vec<_>>().to_array().to_any()
    }

    fn object<const N: usize>(entries: [(&str, V); N]) -> V {
        entries.map(|(k, v)| (k.into(), v)).to_object().to_any()
    }

    fn num(x: f64) -> V {
        x.to_any()
    }

    #[test]
    fn outcomes_follow_the_independent_throw_marker() {
        fn throws() -> Result<V, V> {
            Err(Any::undefined())
        }
        fn value() -> Result<V, V> {
            Ok(object([("default", Any::undefined())]))
        }
        for json in [Some(&b"1"[..]), None] {
            let case = Case {
                name: "regression",
                fixture: throws,
                expected: throws,
                throws: false,
                json,
            };
            assert!(check(&case).is_err());
        }
        let case = Case {
            name: "throw",
            fixture: value,
            expected: value,
            throws: true,
            json: None,
        };
        assert!(check(&case).is_err());
        assert_eq!(
            check(&Case {
                throws: false,
                ..case
            }),
            Ok(())
        );
        assert_eq!(
            check(&Case {
                fixture: throws,
                expected: throws,
                ..case
            }),
            Ok(())
        );
        assert!(
            check(&Case {
                fixture: throws,
                throws: false,
                ..case
            })
            .is_err()
        );
        assert!(
            check(&Case {
                expected: throws,
                throws: false,
                ..case
            })
            .is_err()
        );
    }

    /// `[shared, shared]` is one node reached twice; two equal copies are
    /// not it, in either direction.
    #[test]
    fn sharing_is_compared() {
        let shared = object([("x", num(1.0))]);
        let twice = array([shared.clone(), shared]);
        let copies = array([object([("x", num(1.0))]), object([("x", num(1.0))])]);
        assert_eq!(same_graph(&twice, &twice.clone()), Ok(()));
        assert_eq!(same_graph(&copies, &copies.clone()), Ok(()));
        assert_eq!(
            same_graph(&twice, &copies),
            Err("$[1]: sharing differs".into())
        );
        assert_eq!(
            same_graph(&copies, &twice),
            Err("$[1]: sharing differs".into())
        );
    }

    /// `NaN` equals itself and `-0` is not `0`: numbers compare by bits.
    #[test]
    fn numbers_compare_by_bits() {
        assert_eq!(same_graph(&num(f64::NAN), &num(f64::NAN)), Ok(()));
        assert_eq!(
            same_graph(&num(-0.0), &num(0.0)),
            Err("$: -0.0 is not 0.0".into())
        );
    }

    /// Entries compare in order, and a duplicated raw slot is the one entry
    /// an interpreter's normalized object has.
    #[test]
    fn objects_compare_by_observable_entries() {
        let ab = object([("a", num(1.0)), ("b", num(2.0))]);
        let ba = object([("b", num(2.0)), ("a", num(1.0))]);
        assert_eq!(
            same_graph(&ab, &ba),
            Err("$: key \"a\" is not \"b\"".into())
        );
        let overwritten = object([("a", num(0.0)), ("b", num(2.0)), ("a", num(1.0))]);
        assert_eq!(same_graph(&overwritten, &ab), Ok(()));
        assert_eq!(
            same_graph(&ab, &object([("a", num(1.0))])),
            Err("$: 2 entries are not 1".into())
        );
    }

    /// A difference is reported with the path to it, and a container is not a
    /// leaf of the same value.
    #[test]
    fn differences_are_located() {
        let a = array([num(1.0), object([("k", array([num(2.0)]))])]);
        let b = array([num(1.0), object([("k", array([num(3.0)]))])]);
        assert_eq!(
            same_graph(&a, &b),
            Err("$[1].\"k\"[0]: 2.0 is not 3.0".into())
        );
        assert_eq!(
            same_graph(&array([num(1.0)]), &array([])),
            Err("$: length 1 is not 0".into())
        );
        assert!(same_graph(&array([]), &object([])).is_err());
    }
}
