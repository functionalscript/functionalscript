//! The console, files and directories over `std`, performed for the loop of [`crate::run`].
//!
//! A [`Native`] is generic over its three streams so that it can be proven
//! without touching the process's own; [`Native::stdio`] is the one over the
//! real ones. Its [`perform`](Native::perform) is the `perform` the loop takes:
//! it reads the request from VM values, runs the operation and answers the
//! `Result` the language reads, as `fjs/effects/node/module.mjs` does.

use crate::{
    codec::{
        Malformed, argument, arity, decode_bytes, decode_choice, decode_flag, decode_literal,
        decode_nullable, decode_number, decode_object, decode_optional, decode_string, decode_true,
        encode_array, encode_bool, encode_bytes, encode_nothing, encode_nullable, encode_number,
        encode_object, encode_ok, encode_string, encode_tuple, member, required,
    },
    files::{self, Dirent, IoError},
    resolve::{FileModule, resolve_file_module},
};
use nanvm_lib::vm::{Any, Array, IVm, unstable::string_any};
use std::io::{self, ErrorKind, Read, Write};

/// A host over `std`, reading console input from `R` and writing console
/// output to `O` and `E`.
#[derive(Debug)]
pub struct Native<R, O, E> {
    stdin: R,
    stdout: O,
    stderr: E,
}

impl Native<io::Stdin, io::Stdout, io::Stderr> {
    /// The host over the real standard streams.
    pub fn stdio() -> Self {
        Self::new(io::stdin(), io::stdout(), io::stderr())
    }
}

impl<R, O, E> Native<R, O, E> {
    pub fn new(stdin: R, stdout: O, stderr: E) -> Self {
        Self {
            stdin,
            stdout,
            stderr,
        }
    }

    /// What has been written to the standard output stream.
    pub fn stdout(&self) -> &O {
        &self.stdout
    }

    /// What has been written to the standard error stream.
    pub fn stderr(&self) -> &E {
        &self.stderr
    }
}

/// What a host answers a command it has no operation for: `['error',
/// ['notImplemented', command]]`, through the ordinary continuation, so the
/// program decides what that means.
fn not_implemented<A: IVm>(command: &str) -> Any<A> {
    encode_tuple(
        "error",
        vec![encode_tuple(
            "notImplemented",
            vec![encode_string(command.to_string())],
        )],
    )
}

/// An operation's answer as the language reads a `Result`: a failure is
/// `['error', ['ioError', {code?, message}]]`.
fn answer<A: IVm, T>(result: Result<T, IoError>, ok: impl FnOnce(T) -> Any<A>) -> Any<A> {
    match result {
        Ok(value) => encode_ok(ok(value)),
        Err(IoError { code, message }) => encode_tuple(
            "error",
            vec![encode_tuple(
                "ioError",
                vec![encode_object(vec![
                    code.map(|code| ("code", encode_string(code))),
                    Some(("message", encode_string(message))),
                ])],
            )],
        ),
    }
}

fn encode_file_module<A: IVm>(module: FileModule) -> Any<A> {
    encode_object(vec![
        Some(("id", encode_string(module.id))),
        Some(("path", encode_string(module.path))),
    ])
}

fn encode_dirent<A: IVm>(dirent: Dirent) -> Any<A> {
    encode_object(vec![
        Some(("name", encode_string(dirent.name))),
        Some(("parentPath", encode_string(dirent.parent_path))),
        Some(("isFile", encode_bool(dirent.is_file))),
        Some(("isDirectory", encode_bool(dirent.is_directory))),
    ])
}

impl<R: Read, O: Write, E: Write> Native<R, O, E> {
    /// Performs `command` with `payload`: the answer is a `Result` for the
    /// continuation. A request that is not one the operation takes is thrown
    /// in the language, as the JavaScript runners' `assert` ends their loop.
    pub fn perform<A: IVm>(&mut self, command: Any<A>, payload: Any<A>) -> Result<Any<A>, Any<A>> {
        self.dispatch(command, payload)
            .map_err(|Malformed(what)| string_any(&what))
    }

    fn dispatch<A: IVm>(&mut self, command: Any<A>, payload: Any<A>) -> Result<Any<A>, Malformed> {
        let command = decode_string(command)?;
        let Ok(payload) = Array::try_from(payload) else {
            return Err(Malformed("a payload that is not an array".to_string()));
        };
        let payload: Vec<Any<A>> = payload.into_iter().collect();
        let payload = payload.as_slice();
        match command.as_str() {
            "write" => {
                arity(payload, 2)?;
                let stream = decode_choice(argument(payload, 0, "stream")?, &["stdout", "stderr"])?;
                let data = decode_bytes(argument(payload, 1, "data")?)?;
                self.write(stream == 1, &data);
                Ok(encode_ok(encode_nothing(())))
            }
            "read" => {
                arity(payload, 1)?;
                decode_literal(argument(payload, 0, "stream")?, "stdin")?;
                Ok(encode_ok(encode_nullable(self.read(), encode_number)))
            }
            "mkdir" => {
                arity(payload, 2)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                let recursive = decode_optional(payload.get(1).cloned(), |options| {
                    let options = decode_object(options, &["recursive"])?;
                    decode_true(required(&options, "recursive")?)
                })?
                .is_some();
                Ok(answer(files::mkdir(&path, recursive), encode_nothing))
            }
            "readFile" => {
                arity(payload, 1)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                Ok(answer(files::read_file(&path), encode_bytes))
            }
            "readdir" => {
                arity(payload, 2)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                let options = decode_object(argument(payload, 1, "options")?, &["recursive"])?;
                let recursive = decode_flag(member(&options, "recursive"))?;
                Ok(answer(files::readdir(&path, recursive), |entries| {
                    encode_array(entries, encode_dirent)
                }))
            }
            "writeFile" => {
                arity(payload, 2)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                let data = decode_bytes(argument(payload, 1, "data")?)?;
                Ok(answer(files::write_file(&path, &data), encode_nothing))
            }
            "writeBytes" => {
                arity(payload, 3)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                let offset = decode_number(argument(payload, 1, "offset")?)?;
                let data = decode_bytes(argument(payload, 2, "data")?)?;
                Ok(answer(
                    files::write_bytes(&path, offset, &data),
                    encode_nothing,
                ))
            }
            "resolveFileModule" => {
                arity(payload, 2)?;
                let name = decode_string(argument(payload, 0, "name")?)?;
                let parent = decode_nullable(argument(payload, 1, "parent")?, decode_string)?;
                Ok(answer(
                    resolve_file_module(&name, parent.as_deref()),
                    |module| encode_file_module(module),
                ))
            }
            "rm" => {
                arity(payload, 1)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                Ok(answer(files::rm(&path), encode_nothing))
            }
            _ => Ok(not_implemented(&command)),
        }
    }

    /// Writes all of `data` and flushes, so that it is out when this answers.
    /// The operation has no failure of its own, and a stream that refuses the
    /// data ends the process, as a stream error nobody handles ends Node's.
    fn write(&mut self, stderr: bool, data: &[u8]) {
        if stderr {
            self.stderr
                .write_all(data)
                .and_then(|_| self.stderr.flush())
        } else {
            self.stdout
                .write_all(data)
                .and_then(|_| self.stdout.flush())
        }
        .expect("a console stream refused a write");
    }

    /// The next byte of input, and `None` at its end. A read that fails ends
    /// the process, as for `write`.
    fn read(&mut self) -> Option<f64> {
        let mut byte = [0u8];
        loop {
            match self.stdin.read(&mut byte) {
                Ok(0) => return None,
                Ok(_) => return Some(f64::from(byte[0])),
                Err(e) if e.kind() == ErrorKind::Interrupted => {}
                Err(e) => panic!("console input failed: {e}"),
            }
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use nanvm_lib::{
        naive::Naive,
        vm::{
            Nullish, Number, ToAny, ToArray, ToObject,
            unstable::{bigint_any, string_key},
        },
    };
    use std::io::Cursor;

    type V = Any<Naive>;
    type Host = Native<Cursor<Vec<u8>>, Vec<u8>, Vec<u8>>;

    fn host(input: &[u8]) -> Host {
        Native::new(Cursor::new(input.to_vec()), vec![], vec![])
    }

    fn array(items: impl IntoIterator<Item = V>) -> V {
        items.into_iter().collect::<Vec<_>>().to_array().to_any()
    }

    /// The value of an `['ok', value]` answer.
    fn ok(result: Result<V, V>) -> V {
        let answer: Vec<V> = Array::try_from(result.unwrap())
            .unwrap()
            .into_iter()
            .collect();
        assert_eq!(answer[0], string_any("ok"));
        answer[1].clone()
    }

    /// `"hi"` as the language spells bytes: the bits with a stop bit in front,
    /// negated where the first bit was `0`.
    fn hi() -> V {
        bigint_any(-59497)
    }

    fn write(host: &mut Host, stream: &str) -> Result<V, V> {
        host.perform(string_any("write"), array([string_any(stream), hi()]))
    }

    /// The console writes both streams and reads input a byte at a time, each
    /// answered `['ok', ...]`.
    #[test]
    fn console() {
        let mut h = host(b"a");
        assert_eq!(ok(write(&mut h, "stdout")), Nullish::Undefined.to_any());
        assert_eq!(ok(write(&mut h, "stderr")), Nullish::Undefined.to_any());
        assert_eq!(h.stdout().as_slice(), b"hi");
        assert_eq!(h.stderr().as_slice(), b"hi");
        h.perform(
            string_any("write"),
            array([string_any("stdout"), bigint_any(0)]),
        )
        .unwrap();
        assert_eq!(h.stdout().as_slice(), b"hi");
        let read = |h: &mut Host| ok(h.perform(string_any("read"), array([string_any("stdin")])));
        assert_eq!(read(&mut h), Number::from(97.0).to_any());
        assert_eq!(read(&mut h), Nullish::Null.to_any());
    }

    /// A command the host lacks is answered through the continuation as
    /// `['error', ['notImplemented', command]]`.
    #[test]
    fn a_command_the_host_lacks() {
        let result = host(b"").perform(string_any("fetch"), array([]));
        assert_eq!(
            result.unwrap().to_json(),
            Ok("[\"error\",[\"notImplemented\",\"fetch\"]]".into())
        );
    }

    /// A request that is not one the operation takes is thrown, naming why.
    #[test]
    fn malformed_requests_throw() {
        let throws = |command: V, payload: V| {
            let thrown = host(b"").perform(command, payload).unwrap_err();
            decode_string(thrown).unwrap()
        };
        let w = || string_any("write");
        assert_eq!(throws(Nullish::Null.to_any(), array([])), "not a string");
        assert_eq!(
            throws(w(), Nullish::Null.to_any()),
            "a payload that is not an array"
        );
        assert_eq!(
            throws(w(), array([string_any("stdout")])),
            "missing argument 1, `data`"
        );
        assert_eq!(
            throws(w(), array([string_any("stdout"), hi(), hi()])),
            "3 arguments where at most 2 are taken"
        );
        assert_eq!(
            throws(w(), array([string_any("net"), hi()])),
            "`net` is not one of [\"stdout\", \"stderr\"]"
        );
        assert_eq!(
            throws(w(), array([string_any("stdout"), bigint_any(0b1101)])),
            "a bit vector that is not whole bytes"
        );
        assert_eq!(
            throws(w(), array([string_any("stdout"), string_any("hi")])),
            "not a bit vector"
        );
        assert_eq!(
            throws(string_any("read"), array([string_any("stdout")])),
            "not `stdin`"
        );
    }

    /// An interrupted read is tried again.
    #[test]
    fn interrupted_read() {
        struct Once(bool);
        impl Read for Once {
            fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
                if std::mem::replace(&mut self.0, true) {
                    buf[0] = 7;
                    Ok(1)
                } else {
                    Err(ErrorKind::Interrupted.into())
                }
            }
        }
        let mut h = Native::new(Once(false), Vec::new(), Vec::new());
        assert_eq!(h.read(), Some(7.0));
    }

    #[test]
    #[should_panic(expected = "a console stream refused a write")]
    fn refused_write() {
        struct Full;
        impl Write for Full {
            fn write(&mut self, _: &[u8]) -> io::Result<usize> {
                Err(ErrorKind::BrokenPipe.into())
            }
            fn flush(&mut self) -> io::Result<()> {
                Ok(())
            }
        }
        Native::new(Cursor::new(vec![]), Full, Vec::new()).write(false, &[1]);
    }

    #[test]
    #[should_panic(expected = "console input failed")]
    fn failed_read() {
        struct Broken;
        impl Read for Broken {
            fn read(&mut self, _: &mut [u8]) -> io::Result<usize> {
                Err(ErrorKind::BrokenPipe.into())
            }
        }
        Native::new(Broken, Vec::new(), Vec::new()).read();
    }

    fn object(members: impl IntoIterator<Item = (&'static str, V)>) -> V {
        members
            .into_iter()
            .map(|(key, value)| (string_key::<Naive>(key), value))
            .collect::<Vec<_>>()
            .to_object()
            .to_any()
    }

    fn recursive(value: bool) -> V {
        object([("recursive", value.to_any())])
    }

    fn perform(command: &str, payload: impl IntoIterator<Item = V>) -> Result<V, V> {
        host(b"").perform(string_any(command), array(payload))
    }

    fn thrown(command: &str, payload: impl IntoIterator<Item = V>) -> String {
        decode_string(perform(command, payload).unwrap_err()).unwrap()
    }

    /// A request that is not one the operation takes is thrown, naming why.
    #[test]
    fn malformed_file_requests_throw() {
        let path = || string_any("p");
        assert_eq!(thrown("mkdir", [path(), recursive(false)]), "not `true`");
        assert_eq!(thrown("mkdir", [path(), string_any("x")]), "not an object");
        assert_eq!(
            thrown("mkdir", [path(), object([("x", hi())])]),
            "unexpected member `x`"
        );
        assert_eq!(
            thrown("mkdir", [path(), object([])]),
            "missing member `recursive`"
        );
        assert_eq!(thrown("readdir", [path()]), "missing argument 1, `options`");
        assert_eq!(
            thrown("readdir", [path(), recursive(false)]),
            "a flag that is not `true`"
        );
        assert_eq!(
            thrown("writeBytes", [path(), string_any("0"), hi()]),
            "not a number"
        );
        assert_eq!(thrown("rm", [Nullish::Null.to_any()]), "not a string");
    }

    /// The operations through `perform`, against a real directory, which a
    /// WebAssembly host does not give a test.
    #[cfg(not(target_family = "wasm"))]
    #[test]
    fn files_through_perform() {
        let dir =
            std::env::temp_dir().join(format!("nanvm-effects-node-perform-{}", std::process::id()));
        let at = |name: &str| string_any(&dir.join(name).to_string_lossy());
        std::fs::create_dir_all(&dir).unwrap();
        let undefined = || Nullish::Undefined.to_any();

        assert_eq!(ok(perform("mkdir", [at("a"), undefined()])), undefined());
        assert_eq!(
            ok(perform("mkdir", [at("b/c"), recursive(true)])),
            undefined()
        );
        assert_eq!(ok(perform("writeFile", [at("f"), hi()])), undefined());
        assert_eq!(ok(perform("readFile", [at("f")])), hi());
        assert_eq!(
            ok(perform(
                "writeBytes",
                [at("f"), Number::from(1.0).to_any(), hi()]
            )),
            undefined()
        );
        let names = |entries: V| -> Vec<String> {
            Array::try_from(entries)
                .unwrap()
                .into_iter()
                .map(|entry| {
                    let name = nanvm_lib::vm::Object::try_from(entry)
                        .unwrap()
                        .own_property(&"name".into())
                        .unwrap();
                    decode_string(name).unwrap()
                })
                .collect()
        };
        let root = string_any(&dir.to_string_lossy());
        assert_eq!(
            names(ok(perform("readdir", [root.clone(), object([])]))),
            ["a", "b", "f"]
        );
        assert_eq!(
            names(ok(perform("readdir", [root, recursive(true)]))),
            ["a", "b", "f", "c"]
        );
        assert_eq!(ok(perform("rm", [at("f")])), undefined());

        let missing = perform("readFile", [at("f")]).unwrap();
        let [tag, error]: [V; 2] = Array::try_from(missing)
            .unwrap()
            .into_iter()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        assert_eq!(tag, string_any("error"));
        let [kind, info]: [V; 2] = Array::try_from(error)
            .unwrap()
            .into_iter()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        assert_eq!(kind, string_any("ioError"));
        let code = nanvm_lib::vm::Object::try_from(info)
            .unwrap()
            .own_property(&"code".into())
            .unwrap();
        assert_eq!(code, string_any("ENOENT"));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// `resolveFileModule` through `perform`: the working directory is where
    /// a test runs, a crate's own directory.
    #[cfg(not(target_family = "wasm"))]
    #[test]
    fn resolving_a_module_through_perform() {
        let module = ok(perform(
            "resolveFileModule",
            [string_any("Cargo.toml"), Nullish::Null.to_any()],
        ));
        let member = |name: &str| {
            let value = nanvm_lib::vm::Object::try_from(module.clone())
                .unwrap()
                .own_property(&name.into())
                .unwrap();
            decode_string(value).unwrap()
        };
        assert!(member("path").ends_with("/Cargo.toml"));
        assert_eq!(member("id"), format!("file://{}", member("path")));
        let sibling = ok(perform(
            "resolveFileModule",
            [string_any("./src/lib.rs"), string_any(&member("id"))],
        ));
        assert!(
            decode_string(
                nanvm_lib::vm::Object::try_from(sibling)
                    .unwrap()
                    .own_property(&"path".into())
                    .unwrap()
            )
            .unwrap()
            .ends_with("/nanvm-effects-node/src/lib.rs")
        );
    }

    #[test]
    fn a_parent_that_is_not_a_string_throws() {
        assert_eq!(
            thrown("resolveFileModule", [string_any("a"), hi()]),
            "not a string"
        );
    }
}
