//! The MVP walking skeleton (`todo/fjs-nanvm-integration.md`,
//! `nanvm-lib/todo/mvp-roadmap.md`): evaluate a compiled module, select one
//! of its exports, read or call it, and print the result as JSON.
//!
//! `fjs run ./fjs/nanvm/harness/module.f.mjs` (`npm run gen`) compiles each of
//! `fixtures/*.mjs` into `gen.fixtures/*.rs` through the Rust code generator,
//! named after its Rust module (`function-scope.mjs` becomes
//! `function_scope.rs`), and writes `gen.fixtures/mod.rs` naming every one —
//! committed and drift-checked (see `../../fjs/ci/README.md`) the same way
//! `nanvm-lib/tests/test/gen.corpus/` is. The directory is the list of
//! fixtures: adding one is adding its `.mjs`. [`fixtures`] pulls them in with
//! one `#[path]`: a `gen.` name is never a Rust identifier.

/// The compiled fixtures, `gen.fixtures/*.rs`, named by the generated
/// `gen.fixtures/mod.rs`; one `#[path]` names that file.
#[path = "../gen.fixtures/mod.rs"]
pub mod fixtures;

/// The expectation of each corpus fixture, `gen.expected/*.rs`, named by the
/// generated `gen.expected/mod.rs`: the value of its default as a graph, and
/// its JSON text where it has one. The comparison with the compiled fixture
/// is the next step's.
#[path = "../gen.expected/mod.rs"]
pub mod expected;

use core::fmt::{self, Debug, Display, Formatter};

use nanvm_lib::vm::{Any, Array, Function, IVm, JsonError, Object};

/// What the harness does with the selected export.
pub enum Action<A: IVm> {
    /// Its value, as it stands.
    Read,
    /// Its result, called with these arguments: `nanvm-lib` values, built
    /// with the constructors the generated code uses. A JSON or text form
    /// would need a JSON reader, which `nanvm-lib` does not have.
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
    /// the caller passed it. It is the caller's text, never a VM value, so
    /// it compares and prints without a VM.
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
/// them, with no fallback to it: a module without one answers
/// `NoExport("default")` for it.
///
/// A call converts a clone of the selected value with
/// [`Function::try_from`], whose own error is a fresh `TypeError`, so that
/// [`RunError::NotCallable`] holds the value the caller tried to call. It
/// does not go through `Any::call`, where a value that is not a function
/// would be a thrown `TypeError`, indistinguishable from the program
/// throwing.
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
        vm::{Any, Array, Function, IVm, JsonError, Nullish, Number, Object, ToAny, ToArray},
    };

    use crate::{
        Action, RunError,
        fixtures::{
            arity, array, at, bigint, boolean, call, calls, closure, closure_identity,
            closure_throws, entry, escapes, exports, function, function_scope, function_text, lazy,
            length, method, missing, named, named_imports, named_imports_throws, nested,
            not_a_function, nullish, number, object, object_spread, operators, optional,
            parameters, property, recursion, rest, rest_function, sharing, spread, string, throw,
            throws, to_string,
        },
        run,
    };

    /// A compiled fixture's `module`, at the VM every test runs.
    type Module = fn() -> Result<Any<Naive>, Any<Naive>>;

    /// The fixture's default export as JSON text, the way most tests read it.
    ///
    /// The tests stay `#[test]`s rather than rows of one table: a failing
    /// one then fails alone, under its own name, while the rest still run,
    /// and the doc comment saying what it proves stays on it.
    fn read_default(module: Module) -> Result<std::string::String, RunError<Naive>> {
        run(module, "default", Action::Read)
    }

    /// The fixture's default export as a value, for a test that checks what
    /// JSON cannot hold.
    fn default_export(module: Module) -> Any<Naive> {
        module().unwrap().dot("default".into()).end().unwrap()
    }

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
        let error = read_default(throwing).unwrap_err();
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
        let _ = read_default(not_an_object);
    }

    /// The failure contract from source to run: `1n / 0n` throws in
    /// JavaScript, and the compiled module answers the thrown value.
    #[test]
    fn compiled_throw_is_reported() {
        assert!(matches!(
            read_default(throws::module),
            Err(RunError::Thrown(_))
        ));
        // A property read on a nullish base: the compiler writes the read,
        // and the VM throws the `TypeError` JavaScript throws.
        assert!(matches!(
            read_default(nullish::module),
            Err(RunError::Thrown(_))
        ));
    }

    /// The language's own `throw`: a function whose block body ends in the
    /// statement fails with the value when called, and the module, calling
    /// it at load, answers that value — `7`, the argument it threw.
    #[test]
    fn compiled_throw_statement_is_reported() {
        assert_eq!(
            read_default(throw::module),
            Err(RunError::Thrown(Number::from(7.0).to_any()))
        );
    }

    /// Every eager operator, computed by `nanvm-lib` from the compiled
    /// module, against what a JavaScript engine gives the same source.
    #[test]
    fn operators() {
        assert_eq!(
            read_default(operators::module),
            Ok(
                "[7,5,12,1.5,2,36,-6,-7,false,\"number\",true,true,false,true,true,false,true,2,7,7,12,3,3,\"ab\",7]"
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
            read_default(lazy::module),
            Ok("[0,2,null,1,3,\"x\",0,4,5,false,7,8,2,10,11,13,2]".into())
        );
    }

    /// Functions, end to end: a function of one rest parameter is a closure
    /// bound through `IStaticFunction`, a call is `Any::call`, and the
    /// arguments reach the body as its `args`.
    #[test]
    fn functions() {
        assert_eq!(read_default(call::module), Ok("41".into()));
        assert_eq!(read_default(arity::module), Ok("[0,2]".into()));
        assert_eq!(read_default(rest::module), Ok("[1,2,3]".into()));
        assert_eq!(read_default(calls::module), Ok("[1,2]".into()));
        assert_eq!(read_default(nested::module), Ok("[2,3]".into()));
        assert_eq!(read_default(length::module), Ok("0".into()));
        // spec/README.md's sharing example: `pair` is bound once inside the
        // function's own scope, where `a` is, and cloned at each reference.
        assert_eq!(
            read_default(function_scope::module),
            Ok("[[1,1],[1,1]]".into())
        );
    }

    /// Spread, end to end: an array's elements and a string's code points
    /// spliced into an array literal and a call's arguments, a method
    /// call's included — the values Node gives the fixture.
    #[test]
    fn spreads() {
        assert_eq!(
            read_default(spread::module),
            Ok(r#"[[0,1,2,3],["a","😀"],[1,2,4],4,2]"#.into())
        );
    }

    /// Object spread, end to end: an object's own properties copied in
    /// place, a later value at the earlier key's position, an array's
    /// elements by index, a string's code units, nothing from `null` — the
    /// values Node gives the fixture.
    #[test]
    fn object_spreads() {
        assert_eq!(
            read_default(object_spread::module),
            Ok(r#"[{"a":1,"b":2,"c":3},{"b":2,"a":1},{"a":0,"b":2},{"0":"p","z":0},{"0":"a","1":"\ud83d","2":"\ude00"},{}]"#.into())
        );
    }

    /// A function as the default export, called rather than read: with no
    /// arguments, and with a rest parameter that gathers what it is given.
    #[test]
    fn function_exports() {
        assert_eq!(
            run::<Naive>(function::module, "default", Action::Call(Array::default())),
            Ok("42".into())
        );
        let args = [1.0.to_any(), 2.0.to_any()].to_array();
        assert_eq!(
            run::<Naive>(rest_function::module, "default", Action::Call(args)),
            Ok("[1,2]".into())
        );
    }

    /// An undefined body still produces an ordinary callable, with its own
    /// identity and source text, including when constructed inside a call.
    #[test]
    fn undefined_function_exports() {
        let exports: Object<Naive> = function::module::<Naive>().unwrap().try_into().unwrap();
        let noop = exports.own_property(&"noop".into()).unwrap();
        assert_eq!(noop, exports.own_property(&"repeated".into()).unwrap());
        assert_ne!(noop, exports.own_property(&"other".into()).unwrap());
        let make = Function::try_from(exports.own_property(&"make".into()).unwrap()).unwrap();
        let first = make.call(Array::default()).unwrap();
        let second = make.call(Array::default()).unwrap();
        assert_ne!(first, second);
        for value in [noop, first, second] {
            assert_eq!(value.clone().to_string(), Ok("()=>undefined".into()));
            let callable = Function::try_from(value).unwrap();
            assert_eq!(callable.length(), 0);
            assert_eq!(
                callable.call(Array::default()),
                Ok(Nullish::Undefined.to_any())
            );
        }
    }

    /// The `entry` helper, end to end: compiled as `['entry']`, printed as
    /// the static function answering `Any::entry`, and read, called and
    /// passed as the function it is.
    #[test]
    fn entry_helper() {
        assert_eq!(
            read_default(entry::module),
            Ok(r#"[1,3,true,8,8,true,true,"a",true,true,2,"function",9,5,true,true]"#.into())
        );
    }

    #[test]
    fn named_and_rest_parameters() {
        assert_eq!(
            read_default(parameters::module),
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
            read_default(closure::module),
            Ok("[3,15,[1,2,3,1],42]".into())
        );
    }

    /// Closure identity: two closures made by one function are distinct
    /// while one binding read twice is the same, and a captured object keeps
    /// its identity through the frame. The expected text is what Node prints.
    #[test]
    fn closure_identity() {
        assert_eq!(
            read_default(closure_identity::module),
            Ok("[1,1,false,true,true,true]".into())
        );
    }

    /// A failure computing a frame element fails where the closure is made,
    /// not where it is called: the module itself throws.
    #[test]
    fn closure_frame_failure_is_at_creation() {
        assert!(matches!(
            read_default(closure_throws::module),
            Err(RunError::Thrown(_))
        ));
    }

    /// A function that names itself: its `self`, the EDAG node the Rust
    /// printer spells as the closure's own `self_`, calls the function it
    /// is, is the one identity every read, and is captured by a function
    /// nested in it as any value of the scope around it is.
    #[test]
    fn recursion() {
        assert_eq!(read_default(recursion::module), Ok("[120,true,3]".into()));
    }

    /// A function's text is the FunctionalScript writer's: converted where
    /// it is made, returned from a call with its capture named by its slot,
    /// and exported, read as a value and converted by the host. Two functions
    /// with one text stay two identities.
    #[test]
    fn function_texts() {
        assert_eq!(
            read_default(function_text::module),
            Ok(r#"["()=>1","()=>1!","()=>1|2","(...$1)=>$0[0]+$1[0]","(...$0)=>(...$1)=>$0[0]+$1[0]",true,false]"#.into())
        );
        let exports: Object<Naive> = function_text::module::<Naive>()
            .unwrap()
            .try_into()
            .unwrap();
        let inc = exports.own_property(&"inc".into()).unwrap();
        assert_eq!(inc.to_string(), Ok("(...$1)=>$0[0]+$1[0]".into()));
    }

    /// A read past the arguments supplied answers `undefined` — which has
    /// no JSON, so the value is checked as it is — and calling what is not
    /// a function throws.
    #[test]
    fn missing_argument_and_non_function_callee() {
        assert_eq!(default_export(missing::module), Nullish::Undefined.to_any());
        assert!(matches!(
            read_default(not_a_function::module),
            Err(RunError::Thrown(_))
        ));
    }

    #[test]
    fn named_exports() {
        assert_eq!(
            named::module::<Naive>().unwrap().to_json(),
            Ok(r#"{"a":[5],"default":[5],"z":[5]}"#.into())
        );
        assert_eq!(read_default(named::module), Ok("[5]".into()));
    }

    /// The MVP acceptance example (`todo/fjs-nanvm-integration.md`): a
    /// named-only module calls a function it imports by name, and the
    /// harness selects its `main` and calls it with no arguments.
    #[test]
    fn named_imports_and_captures() {
        let select = |name, action| run::<Naive>(named_imports::module, name, action);
        assert_eq!(
            select("main", Action::Call(Array::default())),
            Ok("42".into())
        );
        assert_eq!(
            select("checks", Action::Read),
            Ok("[true,true,true,true,true,true]".into())
        );
        // A dependency that throws while evaluating is the importer's throw.
        assert!(matches!(
            run::<Naive>(named_imports_throws::module, "value", Action::Read),
            Err(RunError::Thrown(_))
        ));
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

    /// A bigint literal at and past the end of `i64`, read back as the decimal
    /// text JavaScript gives each (JSON cannot hold a bigint).
    #[test]
    fn bigint_literals() {
        let list = default_export(bigint::module);
        let expected = [
            "9223372036854775807",
            "-9223372036854775808",
            "9223372036854775808",
            "-9223372036854775809",
            "295147905179352825855",
            "123456789012345678901234567890",
        ];
        for (i, text) in expected.into_iter().enumerate() {
            let item = Any::dot(list.clone(), Number::from(i as f64).to_any())
                .end()
                .unwrap();
            assert_eq!(item.to_string().unwrap(), text.into());
        }
    }

    #[test]
    fn number_constant() {
        assert_eq!(read_default(number::module), Ok("42".into()));
    }

    #[test]
    fn string_constant() {
        assert_eq!(read_default(string::module), Ok(r#""hello""#.into()));
    }

    #[test]
    fn boolean_constant() {
        assert_eq!(read_default(boolean::module), Ok("true".into()));
    }

    #[test]
    fn array_literal() {
        assert_eq!(read_default(array::module), Ok("[1,2,3]".into()));
    }

    #[test]
    fn object_literal() {
        assert_eq!(
            read_default(object::module),
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
            read_default(sharing::module),
            Ok(r#"[{"x":1},{"x":1}]"#.into())
        );
    }

    #[test]
    fn property_access() {
        assert_eq!(read_default(property::module), Ok("42".into()));
    }

    /// `o.f(42)`: the read's continuation calls `f` — a method call, one
    /// chain — and the call reaches the function with its arguments.
    #[test]
    fn method_call() {
        assert_eq!(read_default(method::module), Ok("42".into()));
    }

    /// The optional chains (`fjs/edag/README.md`, Chains): a guarded
    /// access and its steps skipped on a nullish base, a guarded call on
    /// a property reference, kept as the receiver, a guarded call on a
    /// nullish callee, and a group ending a region — `(o?.a).b` two nodes
    /// where `o?.a.b` is one.
    #[test]
    fn optional_chains() {
        assert_eq!(read_default(optional::module), Ok("[1,0,0,2,0,1]".into()));
    }

    /// `a.at(i)`: a built-in member function of one type, reading its
    /// receiver — from the start, from the end, out of range, and with
    /// the index converted.
    #[test]
    fn at_method() {
        assert_eq!(
            read_default(at::module),
            Ok("[10,30,true,true,20,20,10]".into())
        );
    }

    /// `x.toString()` on every type, a built-in member function the
    /// receiver does not own, and an own `toString` shadowing it.
    #[test]
    fn to_string_method() {
        assert_eq!(
            read_default(to_string::module),
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
            read_default(escapes::module),
            Ok("[\"\\u0000\",\"\\u001f\",\"\u{7f}\",\"\u{202e}\",\"\u{2069}\"]".into())
        );
    }
}
