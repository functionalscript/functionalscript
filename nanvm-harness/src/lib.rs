//! The MVP walking skeleton (`todo/fjs-nanvm-integration.md`,
//! `nanvm-lib/todo/mvp-roadmap.md`): evaluate a compiled module, select one
//! of its exports, read or call it, and print the result as JSON.
//!
//! `fjs compile <module> <output>.rs` (the Rust code generator) compiles
//! each of `fixtures/*.mjs` into a sibling `fixtures/*.rs`, committed and
//! drift-checked by `npm run gen` (see `../../fjs/ci/README.md`) the same way
//! `nanvm-lib/tests/test/generated.rs` is. The modules below pull those
//! generated files in via `#[path]`, since they live beside the FJS source
//! they were compiled from rather than under `src/`.

#[path = "../fixtures/arity.rs"]
pub mod arity;
#[path = "../fixtures/array.rs"]
pub mod array;
#[path = "../fixtures/at.rs"]
pub mod at;
#[path = "../fixtures/boolean.rs"]
pub mod boolean;
#[path = "../fixtures/call.rs"]
pub mod call;
#[path = "../fixtures/calls.rs"]
pub mod calls;
#[path = "../fixtures/closure.rs"]
pub mod closure;
#[path = "../fixtures/escapes.rs"]
pub mod escapes;
#[path = "../fixtures/exports.rs"]
pub mod exports;
#[path = "../fixtures/function-scope.rs"]
pub mod function_scope;
#[path = "../fixtures/lazy.rs"]
pub mod lazy;
#[path = "../fixtures/length.rs"]
pub mod length;
#[path = "../fixtures/method.rs"]
pub mod method;
#[path = "../fixtures/missing.rs"]
pub mod missing;
#[path = "../fixtures/named.rs"]
pub mod named;
#[path = "../fixtures/named-imports.rs"]
pub mod named_imports;
#[path = "../fixtures/named-imports-throws.rs"]
pub mod named_imports_throws;
#[path = "../fixtures/nested.rs"]
pub mod nested;
#[path = "../fixtures/not-a-function.rs"]
pub mod not_a_function;
#[path = "../fixtures/nullish.rs"]
pub mod nullish;
#[path = "../fixtures/number.rs"]
pub mod number;
#[path = "../fixtures/object.rs"]
pub mod object;
#[path = "../fixtures/operators.rs"]
pub mod operators;
#[path = "../fixtures/parameters.rs"]
pub mod parameters;
#[path = "../fixtures/property.rs"]
pub mod property;
#[path = "../fixtures/rest.rs"]
pub mod rest;
#[path = "../fixtures/sharing.rs"]
pub mod sharing;
#[path = "../fixtures/string.rs"]
pub mod string;
#[path = "../fixtures/throws.rs"]
pub mod throws;
#[path = "../fixtures/to-string.rs"]
pub mod to_string;

use core::fmt::{self, Debug, Display, Formatter};

use nanvm_lib::vm::{Any, Array, Function, IVm, JsonError, Object};

/// What the harness does with the selected export.
pub enum Action<A: IVm> {
    /// Its value, as it stands.
    Read,
    /// Its result, called with these arguments.
    Call(Array<A>),
}

/// Why a run produced no JSON.
///
/// A throw is the language's own failure — `1n / 0n`, a property read on a
/// nullish base the compiler could not see — and the thrown value is an
/// ordinary `Any<A>`, reported as the value it is rather than turned into a
/// panic. `NoExport` and `NotCallable` are the caller's mistakes, not the
/// program's, so neither is reported as a throw.
///
/// `Debug` and `PartialEq` are written out rather than derived: a derive
/// would ask them of `A` itself, which no VM promises, where `Any<A>` has
/// both for every VM.
pub enum RunError<A: IVm> {
    /// The module threw while evaluating, or the called export threw.
    Thrown(Any<A>),
    /// `export` is not an own property of the export object: the name as
    /// the caller passed it.
    NoExport(std::string::String),
    /// `Action::Call` on a value that is not a function: that value.
    NotCallable(Any<A>),
    /// The selected value or call result has no JSON.
    Json(JsonError),
}

impl<A: IVm> Display for RunError<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            RunError::Thrown(v) => write!(f, "uncaught {v:?}"),
            RunError::NoExport(name) => write!(f, "no export {name:?}"),
            RunError::NotCallable(v) => write!(f, "not callable {v:?}"),
            RunError::Json(e) => Display::fmt(e, f),
        }
    }
}

impl<A: IVm> Debug for RunError<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            RunError::Thrown(v) => f.debug_tuple("Thrown").field(v).finish(),
            RunError::NoExport(name) => f.debug_tuple("NoExport").field(name).finish(),
            RunError::NotCallable(v) => f.debug_tuple("NotCallable").field(v).finish(),
            RunError::Json(e) => f.debug_tuple("Json").field(e).finish(),
        }
    }
}

impl<A: IVm> PartialEq for RunError<A> {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (RunError::Thrown(a), RunError::Thrown(b)) => a == b,
            (RunError::NoExport(a), RunError::NoExport(b)) => a == b,
            (RunError::NotCallable(a), RunError::NotCallable(b)) => a == b,
            (RunError::Json(a), RunError::Json(b)) => a == b,
            _ => false,
        }
    }
}

/// Evaluates a module once, selects one of its exports, reads or calls it,
/// and renders that one value as JSON. Nothing else in the export object is
/// called or serialized.
///
/// `module` is exactly the shape `mvp-roadmap.md`'s Rust code generator
/// section says generated modules expose: `pub fn module<A: IVm>() ->
/// Result<Any<A>, Any<A>>`, returning the object of all exports, or the
/// value the module threw. Any other result is a generator bug, not an
/// input, and panics. A module holding a function bounds `A` on
/// `IStaticFunction`, which `naive` implements.
///
/// `export` is looked up among the object's own properties by presence,
/// not by value: an export holding `undefined` is found, and reading it
/// then fails as [`JsonError::Undefined`]. `default` is one name among
/// them, with no fallback to it. A call converts the selected value with
/// [`Function::try_from`] rather than going through `Any::call`, so that a
/// value that is not a function is [`RunError::NotCallable`], not a
/// `TypeError` indistinguishable from the program throwing.
pub fn run<A: IVm>(
    module: fn() -> Result<Any<A>, Any<A>>,
    export: &str,
    action: Action<A>,
) -> Result<std::string::String, RunError<A>> {
    let exports: Object<A> = module()
        .map_err(RunError::Thrown)?
        .try_into()
        .expect("a compiled module returns its export object");
    let value = exports
        .own_property(&export.into())
        .ok_or_else(|| RunError::NoExport(export.into()))?;
    match action {
        Action::Read => value,
        Action::Call(args) => Function::try_from(value.clone())
            .map_err(|_| RunError::NotCallable(value))?
            .call(args)
            .map_err(RunError::Thrown)?,
    }
    .to_json()
    .map_err(RunError::Json)
}

#[cfg(test)]
mod tests {
    use nanvm_lib::{
        naive::Naive,
        vm::{Any, Array, IVm, JsonError, Nullish, Number, ToAny, ToArray},
    };

    use crate::{
        Action, RunError, arity, array, at, boolean, call, calls, closure, escapes, exports,
        function_scope, lazy, length, method, missing, named, named_imports, named_imports_throws,
        nested, not_a_function, nullish, number, object, operators, property, rest, run, sharing,
        string, throws, to_string,
    };

    #[test]
    fn module_result_contains_exports() {
        assert_eq!(
            number::module::<Naive>().unwrap().to_json(),
            Ok(r#"{"default":42}"#.into())
        );
        assert_eq!(
            object::module::<Naive>().unwrap().to_json(),
            Ok(r#"{"default":{"a":1,"b":"two"}}"#.into())
        );
    }

    /// A module written by hand in the shape the generator prints, throwing
    /// a value of the test's choosing.
    fn throwing<A: IVm>() -> Result<Any<A>, Any<A>> {
        Err("boom".into())
    }

    #[test]
    fn thrown_value_is_reported_not_panicked() {
        let error = run::<Naive>(throwing, "default", Action::Read).unwrap_err();
        assert!(matches!(&error, RunError::Thrown(v) if *v == "boom".into()));
        assert_eq!(error.to_string(), "uncaught \"boom\"");
    }

    /// A module written by hand answering what no compiled module does: a
    /// value that is not the export object.
    fn not_an_object<A: IVm>() -> Result<Any<A>, Any<A>> {
        Ok(Number::from(42.0).to_any())
    }

    /// A broken module is refused, not reported as a value with no JSON.
    #[test]
    #[should_panic(expected = "a compiled module returns its export object")]
    fn non_object_module_panics() {
        let _ = run::<Naive>(not_an_object, "default", Action::Read);
    }

    /// The failure contract from source to run: `1n / 0n` throws in
    /// JavaScript, and the compiled module answers the thrown value.
    #[test]
    fn compiled_throw_is_reported() {
        assert!(matches!(
            run::<Naive>(throws::module, "default", Action::Read),
            Err(RunError::Thrown(_))
        ));
        // A property read on a nullish base: the compiler writes the read,
        // and the VM throws the `TypeError` JavaScript throws.
        assert!(matches!(
            run::<Naive>(nullish::module, "default", Action::Read),
            Err(RunError::Thrown(_))
        ));
    }

    /// Every eager operator, computed by `nanvm-lib` from the compiled
    /// module, against what a JavaScript engine gives the same source.
    #[test]
    fn operators() {
        assert_eq!(
            run::<Naive>(operators::module, "default", Action::Read),
            Ok(
                "[7,5,12,1.5,2,36,-6,-7,true,false,true,true,false,true,2,7,7,12,3,3,\"ab\",7]"
                    .into()
            )
        );
    }

    /// The four lazy operators, each from source the grammar reads: the
    /// operand a `&&`, `||` or `??` never reaches and the arm a `?:` does
    /// not select is a thunk never run, so the `1n / 0n` standing in each
    /// of those positions throws nowhere, and the module answers what a
    /// JavaScript engine answers the same source. The last two are a
    /// function's arguments reached only through lazy positions, bound
    /// once by the body and cloned by each thunk.
    #[test]
    fn lazy_operators() {
        assert_eq!(
            run::<Naive>(lazy::module, "default", Action::Read),
            Ok("[0,2,null,1,3,\"x\",0,4,5,false,7,8,2,10,11,13,2]".into())
        );
    }

    /// Functions, end to end: a function of one rest parameter is a closure
    /// bound through `IStaticFunction`, a call is `Any::call`, and the
    /// arguments reach the body as its `args`.
    #[test]
    fn functions() {
        assert_eq!(
            run::<Naive>(call::module, "default", Action::Read),
            Ok("41".into())
        );
        assert_eq!(
            run::<Naive>(arity::module, "default", Action::Read),
            Ok("[0,2]".into())
        );
        assert_eq!(
            run::<Naive>(rest::module, "default", Action::Read),
            Ok("[1,2,3]".into())
        );
        assert_eq!(
            run::<Naive>(calls::module, "default", Action::Read),
            Ok("[1,2]".into())
        );
        assert_eq!(
            run::<Naive>(nested::module, "default", Action::Read),
            Ok("[2,3]".into())
        );
        assert_eq!(
            run::<Naive>(length::module, "default", Action::Read),
            Ok("0".into())
        );
        // spec/README.md's sharing example: `pair` is bound once inside the
        // function's own scope, where `a` is, and cloned at each reference.
        assert_eq!(
            run::<Naive>(function_scope::module, "default", Action::Read),
            Ok("[[1,1],[1,1]]".into())
        );
    }

    #[test]
    fn named_and_rest_parameters() {
        assert_eq!(
            run::<Naive>(super::parameters::module, "default", Action::Read),
            Ok("[3,[1,2,3,[4,5]],true,true,true,1,1,[1,[2,3],4,[5],[2,3],[5]],true,true,true,true]".into())
        );
    }

    /// Closures, end to end: a function's frame is the values its body
    /// names from outside, built where the function is made and read
    /// through `A::frame` — an enclosing function's arguments, a module
    /// `const`, and a capture through a parent's own frame.
    #[test]
    fn closures() {
        assert_eq!(
            run::<Naive>(closure::module, "default", Action::Read),
            Ok("[3,15,[1,2,3,1],42]".into())
        );
    }

    /// A read past the arguments supplied answers `undefined` — which has
    /// no JSON, so the value is checked as it is — and calling what is not
    /// a function throws.
    #[test]
    fn missing_argument_and_non_function_callee() {
        let value = missing::module::<Naive>()
            .unwrap()
            .dot("default".into())
            .end()
            .unwrap();
        assert_eq!(value, Nullish::Undefined.to_any());
        assert!(matches!(
            run::<Naive>(not_a_function::module, "default", Action::Read),
            Err(RunError::Thrown(_))
        ));
    }

    #[test]
    fn named_exports() {
        assert_eq!(
            named::module::<Naive>().unwrap().to_json(),
            Ok(r#"{"a":[5],"default":[5],"z":[5]}"#.into())
        );
        assert_eq!(
            run::<Naive>(named::module, "default", Action::Read),
            Ok("[5]".into())
        );
    }

    #[test]
    fn named_imports_and_captures() {
        let exports = named_imports::module::<Naive>().unwrap();
        let main = exports.clone().dot("main".into()).end().unwrap();
        let result = main.call(Array::default().to_any()).unwrap();
        assert_eq!(result.to_json(), Ok("42".into()));
        let checks = exports.dot("checks".into()).end().unwrap();
        assert_eq!(
            checks.to_json(),
            Ok("[true,true,true,true,true,true]".into())
        );
        assert!(named_imports_throws::module::<Naive>().is_err());
    }

    /// `exports.mjs` against each outcome `run` tells apart. Evaluating the
    /// module succeeds although `fails` throws when called: loading a module
    /// calls none of its exports.
    #[test]
    fn export_selection() {
        let run = |name, action| run::<Naive>(exports::module, name, action);
        // A value, and a call with supplied arguments.
        assert_eq!(run("answer", Action::Read), Ok("[42]".into()));
        let args = [20.0.to_any(), 22.0.to_any()].to_array();
        assert_eq!(run("add", Action::Call(args)), Ok("42".into()));
        // Absent versus a present `undefined`, which then has no JSON.
        assert_eq!(
            run("missing", Action::Read),
            Err(RunError::NoExport("missing".into()))
        );
        assert_eq!(
            run("nothing", Action::Read),
            Err(RunError::Json(JsonError::Undefined))
        );
        // A named-only module has no `default` to fall back on.
        assert_eq!(
            run("default", Action::Read),
            Err(RunError::NoExport("default".into()))
        );
        // Calling a value that is not a function reports that value; a call
        // that throws reports the throw.
        assert!(matches!(
            run("answer", Action::Call(Array::default())),
            Err(RunError::NotCallable(v)) if v.clone().to_json() == Ok("[42]".into())
        ));
        assert!(matches!(
            run("fails", Action::Call(Array::default())),
            Err(RunError::Thrown(_))
        ));
        // Reading a function does not call it: read, `fails` is the
        // function JSON refuses, not the throw a call gives.
        assert_eq!(
            run("fails", Action::Read),
            Err(RunError::Json(JsonError::Function))
        );
        assert_eq!(
            run("add", Action::Read),
            Err(RunError::Json(JsonError::Function))
        );
    }

    /// Selection from a default-only and from a mixed module: `default` is
    /// one name among the exports, found only where the module has it, and
    /// beside it a mixed module's other exports are found too.
    #[test]
    fn default_is_one_export() {
        assert_eq!(
            run::<Naive>(number::module, "default", Action::Read),
            Ok("42".into())
        );
        assert_eq!(
            run::<Naive>(number::module, "z", Action::Read),
            Err(RunError::NoExport("z".into()))
        );
        assert_eq!(
            run::<Naive>(named::module, "default", Action::Read),
            Ok("[5]".into())
        );
        assert_eq!(
            run::<Naive>(named::module, "z", Action::Read),
            Ok("[5]".into())
        );
    }

    /// Each failure prints as what it is.
    #[test]
    fn run_error_display() {
        let display = |name, action| {
            run::<Naive>(exports::module, name, action)
                .unwrap_err()
                .to_string()
        };
        assert_eq!(display("main", Action::Read), r#"no export "main""#);
        assert_eq!(
            display("answer", Action::Call(Array::default())),
            "not callable [42.0]"
        );
        assert_eq!(
            display("nothing", Action::Read),
            "`undefined` has no JSON representation"
        );
    }

    #[test]
    fn number_constant() {
        assert_eq!(
            run::<Naive>(number::module, "default", Action::Read),
            Ok("42".into())
        );
    }

    #[test]
    fn string_constant() {
        assert_eq!(
            run::<Naive>(string::module, "default", Action::Read),
            Ok(r#""hello""#.into())
        );
    }

    #[test]
    fn boolean_constant() {
        assert_eq!(
            run::<Naive>(boolean::module, "default", Action::Read),
            Ok("true".into())
        );
    }

    #[test]
    fn array_literal() {
        assert_eq!(
            run::<Naive>(array::module, "default", Action::Read),
            Ok("[1,2,3]".into())
        );
    }

    #[test]
    fn object_literal() {
        assert_eq!(
            run::<Naive>(object::module, "default", Action::Read),
            Ok(r#"{"a":1,"b":"two"}"#.into())
        );
    }

    #[test]
    fn shared_object_reference() {
        // `[shared, shared]` is one object reached from two places, printed
        // as a single `let c0` binding cloned at each reference
        // (`sharing.rs`) — this only proves the JSON is right; the sharing
        // itself is a property of the generated Rust, not something the
        // JSON output could distinguish from two separate literal objects.
        assert_eq!(
            run::<Naive>(sharing::module, "default", Action::Read),
            Ok(r#"[{"x":1},{"x":1}]"#.into())
        );
    }

    #[test]
    fn property_access() {
        assert_eq!(
            run::<Naive>(property::module, "default", Action::Read),
            Ok("42".into())
        );
    }

    /// `o.f(42)`: the read's continuation calls `f` — a method call, one
    /// chain — and the call reaches the function with its arguments.
    #[test]
    fn method_call() {
        assert_eq!(
            run::<Naive>(method::module, "default", Action::Read),
            Ok("42".into())
        );
    }

    /// `a.at(i)`: a built-in member function of one type, reading its
    /// receiver — from the start, from the end, out of range, and with
    /// the index converted.
    #[test]
    fn at_method() {
        assert_eq!(
            run::<Naive>(at::module, "default", Action::Read),
            Ok("[10,30,true,true,20,20,10]".into())
        );
    }

    /// `x.toString()` on every type, a built-in member function the
    /// receiver does not own, and an own `toString` shadowing it.
    #[test]
    fn to_string_method() {
        assert_eq!(
            run::<Naive>(to_string::module, "default", Action::Read),
            Ok(r#"["1.5","true","ab","5","1,b","[object Object]","own"]"#.into())
        );
    }

    #[test]
    fn escaped_characters() {
        // `escapes.rs` spells each of these as a `\u{…}` escape, since a
        // control character or a bidirectional control cannot stand in a
        // Rust literal as it is; the VM reads back the character itself.
        // `to_json` escapes the two control characters and prints the rest.
        assert_eq!(
            run::<Naive>(escapes::module, "default", Action::Read),
            Ok("[\"\\u0000\",\"\\u001f\",\"\u{7f}\",\"\u{202e}\",\"\u{2069}\"]".into())
        );
    }
}
