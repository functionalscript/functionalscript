//! `fjsrs`: a FunctionalScript program compiled to Rust and run as a native
//! executable, with no JavaScript host.
//!
//! The crate links three things. [`program`] is the generated Rust of the
//! program, `fjs/nanvm/fjsrs/module.f.js`, written by `npm run gen`.
//! `nanvm-lib` is the VM its values live in, and `nanvm-effects-node` the
//! loop and host that perform the effects it answers. What is written by
//! hand is [`run`], which hands a program what a host hands one, and
//! `main.rs`, which is the process around it.
//!
//! The program is the same source on every host: the Node `fjs` and this
//! one differ in what performs the effects, not in what asks for them.

use nanvm_effects_node::Native;
use nanvm_lib::vm::{Any, Array, IVm, Module, Nullish, Number, ToAny, ToArray, ToObject, exports};
use std::io::{Read, Write};

/// VM chosen for this native artifact and its compiled modules.
pub type Vm = nanvm_lib::naive::Naive;

/// The compiled program. Its block and conditional layout follows the source graph.
#[allow(clippy::never_loop, clippy::collapsible_if)]
pub mod program {
    use super::Vm as A;
    include!("gen.program.native.rs");
}

/// What a program is started with, as the Node host's `options` are
/// (`fjs/effects/node/module.mjs`): the arguments after the program's name,
/// the environment, and the user's home directory.
pub struct Options {
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
    pub home: String,
}

impl Options {
    /// The options of this process.
    pub fn of_process() -> Self {
        Self {
            args: std::env::args().skip(1).collect(),
            env: std::env::vars().collect(),
            home: std::env::var("HOME").unwrap_or_default(),
        }
    }

    fn to_any<A: IVm>(&self) -> Any<A> {
        let args = self.args.iter().map(|arg| arg.as_str().into());
        let env = self
            .env
            .iter()
            .map(|(name, value)| (name.as_str().into(), value.as_str().into()));
        [
            ("args".into(), args.to_array().to_any()),
            ("env".into(), env.to_object().to_any()),
            ("home".into(), self.home.as_str().into()),
        ]
        .to_object()
        .to_any()
    }
}

/// Runs the `main` a compiled module exports, on `host`, and answers its
/// exit code.
///
/// The module is evaluated once, its `main` called with `options`, and the
/// effect that answers performed to its end. A program ends in an FJS
/// `Result` whose value is its exit code, `['ok', 0]` or `['error', code]`,
/// and the code is read from either, as `exitCode` in `fjs/effects/node`
/// reads it.
///
/// `Err` is a language throw: from the module's initialization, from `main`
/// or from anything the effects call. A module with no `main`, a `main` that
/// is no function and an end that is no number are throws too, the
/// `TypeError` the language answers the same mistake with: calling what is
/// no function, and reading a number where there is none. A number that is
/// no exit status is refused the same way, by `exit_code`.
pub fn run<A: IVm, R: Read, O: Write, E: Write>(
    module: Module<A>,
    options: &Options,
    host: &mut Native<R, O, E>,
) -> Result<u8, Any<A>> {
    let main = exports(module)?
        .own_property(&"main".into())
        .unwrap_or_else(|| Nullish::Undefined.to_any());
    let effect = Any::call(main, [options.to_any()].to_array().to_any())?;
    let end = nanvm_effects_node::run(effect, |command, payload| host.perform(command, payload))?;
    let code = Array::try_from(end)?
        .into_iter()
        .nth(1)
        .unwrap_or_else(|| Nullish::Undefined.to_any());
    exit_code(f64::from(Number::try_from(code)?))
}

/// The exit status a process can answer: an integer from `0` to `255`. Any
/// other number is refused as a throw naming it. A cast would answer one
/// instead, `0` for `-1` and for `NaN`, and report a program that failed
/// as one that did not.
fn exit_code<A: IVm>(code: f64) -> Result<u8, Any<A>> {
    if code.fract() == 0.0 && (0.0..=255.0).contains(&code) {
        Ok(code as u8)
    } else {
        Err(format!("fjsrs: {code} is no exit code").as_str().into())
    }
}

#[cfg(test)]
mod tests {
    use super::{Options, exit_code, program, run};
    use nanvm_effects_node::Native;
    use nanvm_lib::{
        naive::Naive,
        vm::{Any, Array, IVm, Module, Number, ToAny, ToArray, ToObject, unstable::string_any},
    };

    type A = Naive;

    const COMMANDS: &str = "Available commands:\n  help, h, ?  Print this help message\n";

    /// Runs `module` with `args` over buffers: its exit code or throw, and
    /// what it wrote to standard output and standard error.
    fn started(module: Module<A>, args: &[&str]) -> (Result<u8, Any<A>>, String, String) {
        let options = Options {
            args: args.iter().map(|arg| arg.to_string()).collect(),
            env: vec![("NAME".into(), "value".into())],
            home: "/home/user".into(),
        };
        let mut host = Native::buffered(&[]);
        let code = run(module, &options, &mut host);
        let text = |bytes: &Vec<u8>| String::from_utf8(bytes.clone()).unwrap();
        (code, text(host.stdout()), text(host.stderr()))
    }

    /// The compiled program answers as it does on the Node host: no command
    /// is an error naming the commands, on standard error, with code `1`.
    #[test]
    fn no_command_is_an_error_naming_the_commands() {
        let (code, stdout, stderr) = started(program::module, &[]);
        assert_eq!(code, Ok(1));
        assert_eq!(stdout, "");
        assert_eq!(stderr, format!("Error: command is required.\n{COMMANDS}"));
    }

    #[test]
    fn help_lists_the_commands() {
        let (code, stdout, stderr) = started(program::module, &["help"]);
        assert_eq!(code, Ok(0));
        assert_eq!(stdout, COMMANDS);
        assert_eq!(stderr, "");
    }

    /// The arguments reach the program: the one it does not know is named.
    #[test]
    fn an_unknown_command_is_named() {
        let (code, _, stderr) = started(program::module, &["compile", "a.f.js"]);
        assert_eq!(code, Ok(1));
        assert_eq!(
            stderr,
            format!("Error: unknown command \"compile\".\n{COMMANDS}")
        );
    }

    /// Reads `name` of `value`, as the language's `value.name` does.
    fn member(value: &Any<A>, name: &str) -> Result<Any<A>, Any<A>> {
        Any::dot(value.clone(), string_any(name)).end()
    }

    fn number(value: Any<A>) -> Result<f64, Any<A>> {
        Ok(f64::from(Number::try_from(value)?))
    }

    /// A program whose exit code says what it was started with: the count
    /// of its arguments, ten for the environment variable the test sets,
    /// and a hundred times the length of its home.
    fn counting(_runtime: Any<A>) -> Result<Any<A>, Any<A>> {
        let main = A::static_function(
            |_self, args| {
                let options = args.argument(0);
                let named = member(&member(&options, "env")?, "NAME")? == Any::from("value");
                let code = number(member(&member(&options, "args")?, "length")?)?
                    + if named { 10.0 } else { 0.0 }
                    + 100.0 * number(member(&member(&options, "home")?, "length")?)?;
                let end = [Any::from("error"), code.to_any()].to_array();
                Ok(A::static_function(
                    |this, _| Ok(A::frame(this)[0].clone()),
                    0,
                    [end.to_any()].to_array(),
                    None,
                )
                .to_any())
            },
            1,
            Array::default(),
            None,
        );
        Ok([("main".into(), main.to_any())].to_object().to_any())
    }

    /// The options are the process's: two arguments, the variable, and a
    /// home of two characters make `2 + 10 + 200`.
    #[test]
    fn a_program_is_started_with_its_arguments_environment_and_home() {
        let options = Options {
            args: vec!["a".into(), "b".into()],
            env: vec![("NAME".into(), "value".into())],
            home: "/h".into(),
        };
        assert_eq!(run(counting, &options, &mut Native::buffered(&[])), Ok(212));
    }

    /// Only an integer a process can answer is an exit code: the two ends
    /// are, and a negative one, a fraction, one too large and `NaN` are
    /// refused, where a cast would call the first and the last success.
    #[test]
    fn a_number_that_is_no_exit_status_is_refused() {
        assert_eq!(exit_code::<A>(0.0), Ok(0));
        assert_eq!(exit_code::<A>(255.0), Ok(255));
        for code in [-1.0, 0.5, 256.0, f64::NAN, f64::INFINITY] {
            assert_eq!(
                exit_code::<A>(code),
                Err(format!("fjsrs: {code} is no exit code").as_str().into())
            );
        }
    }

    /// A program whose `main` answers an effect that ends in no `Result`.
    fn ending_in_text(_runtime: Any<A>) -> Result<Any<A>, Any<A>> {
        let end = A::static_function(|_, _| Ok("done".into()), 0, Array::default(), None);
        let main = A::static_function(
            |this, _| Ok(A::frame(this)[0].clone()),
            1,
            [end.to_any()].to_array(),
            None,
        );
        Ok([("main".into(), main.to_any())].to_object().to_any())
    }

    /// A module that throws, one with no `main`, one whose `main` is no
    /// function and one whose end is no exit code are all throws.
    #[test]
    fn what_is_no_program_throws() {
        fn throwing(_runtime: Any<A>) -> Result<Any<A>, Any<A>> {
            Err("boom".into())
        }
        fn empty(_runtime: Any<A>) -> Result<Any<A>, Any<A>> {
            Ok([].to_object().to_any())
        }
        fn number(_runtime: Any<A>) -> Result<Any<A>, Any<A>> {
            Ok([("main".into(), 1.0.to_any())].to_object().to_any())
        }
        assert_eq!(started(throwing, &[]).0, Err("boom".into()));
        assert!(started(empty, &[]).0.is_err());
        assert!(started(number, &[]).0.is_err());
        assert!(started(ending_in_text, &[]).0.is_err());
    }
}
