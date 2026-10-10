//! The console, files and directories over `std`, performed for the loop of [`crate::run`].
//!
//! A [`Native`] is generic over its three streams so that it can be proven
//! without touching the process's own; [`Native::stdio`] is the one over the
//! real ones. Its [`perform`](Native::perform) is the `perform` the loop takes:
//! it reads the request from VM values, runs the operation and answers the
//! `Result` the language reads, as `fjs/effects/node/module.mjs` does.

use crate::{
    codec::{
        Malformed, argument, arity, decode_array, decode_bytes, decode_choice, decode_flag,
        decode_literal, decode_nullable, decode_number, decode_object, decode_optional,
        decode_string, decode_true, encode_array, encode_bool, encode_bytes, encode_nothing,
        encode_nullable, encode_number, encode_object, encode_ok, encode_string, encode_tuple,
        member, optional_argument, required,
    },
    common,
    files::{self, Dirent, IoError, Stat, js_number},
    resolve::{FileModule, resolve_file_module},
};
use nanvm_lib::vm::{Any, Array, IVm, unstable::string_any};
use std::{
    collections::HashMap,
    fs::File,
    io::{self, ErrorKind, Read, Write},
};

/// `NodeOp`'s commands, printed from `nodeCommands` in
/// `fjs/effects/node/module.f.mjs`: a command outside them is a malformed
/// request, not a missing capability.
#[path = "gen.commands.rs"]
mod commands;
use commands::COMMANDS;

/// A host over `std`, reading console input from `R` and writing console
/// output to `O` and `E`.
#[derive(Debug)]
pub struct Native<R, O, E> {
    stdin: R,
    stdout: O,
    stderr: E,
    /// The open files, by handle. A handle is the count of handles given before
    /// it, so none is reused for another file, and a closed one is simply
    /// absent: nothing is kept for it.
    files: HashMap<u64, File>,
    /// How many handles have been given.
    opened: u64,
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
            files: HashMap::new(),
            opened: 0,
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
        encode_tuple("notImplemented", encode_string(command.to_string())),
    )
}

fn malformed_command<T>(command: &str) -> Result<T, Malformed> {
    Err(Malformed(format!("`{command}` is not a command")))
}

/// An operation's answer as the language reads a `Result`: a failure is
/// `['error', ['ioError', {code?, message}]]`.
fn answer<A: IVm, T>(result: Result<T, IoError>, ok: impl FnOnce(T) -> Any<A>) -> Any<A> {
    match result {
        Ok(value) => encode_ok(ok(value)),
        Err(IoError { code, message }) => encode_tuple(
            "error",
            encode_tuple(
                "ioError",
                encode_object([
                    code.map(|code| ("code", encode_string(code))),
                    Some(("message", encode_string(message))),
                ]),
            ),
        ),
    }
}

fn encode_file_module<A: IVm>(module: FileModule) -> Any<A> {
    encode_object([
        Some(("id", encode_string(module.id))),
        Some(("path", encode_string(module.path))),
    ])
}

fn encode_stat<A: IVm>(stat: Stat) -> Any<A> {
    encode_object([
        Some(("size", encode_number(stat.size as f64))),
        Some(("isFile", encode_bool(stat.is_file))),
        Some(("isDirectory", encode_bool(stat.is_directory))),
    ])
}

fn encode_dirent<A: IVm>(dirent: Dirent) -> Any<A> {
    encode_object([
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
        let payload = &payload;
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
                let recursive = decode_optional(optional_argument(payload, 1), |options| {
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
            "readWhole" => {
                arity(payload, 1)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                Ok(answer(files::read_whole(&path), |windows| {
                    encode_array(windows, encode_bytes)
                }))
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
            "stat" => {
                arity(payload, 1)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                Ok(answer(files::stat(&path), encode_stat))
            }
            "access" => {
                arity(payload, 1)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                Ok(answer(files::access(&path), encode_nothing))
            }
            "rename" => {
                arity(payload, 2)?;
                let src = decode_string(argument(payload, 0, "src")?)?;
                let dst = decode_string(argument(payload, 1, "dst")?)?;
                Ok(answer(files::rename(&src, &dst), encode_nothing))
            }
            "rmdir" => {
                arity(payload, 1)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                Ok(answer(files::rmdir(&path), encode_nothing))
            }
            "readBytes" => {
                arity(payload, 3)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                let offset = decode_number(argument(payload, 1, "offset")?)?;
                let size = decode_number(argument(payload, 2, "size")?)?;
                Ok(answer(files::read_bytes(&path, offset, size), encode_bytes))
            }
            "createExclusive" => {
                arity(payload, 1)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                Ok(answer(files::create_exclusive(&path), encode_nothing))
            }
            "writeExclusive" => {
                arity(payload, 2)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                let data = decode_array(argument(payload, 1, "data")?, decode_bytes)?;
                Ok(answer(files::write_exclusive(&path, &data), encode_nothing))
            }
            "open" => {
                arity(payload, 1)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                let opened = files::open(&path).map(|file| {
                    self.files.insert(self.opened, file);
                    self.opened += 1;
                    (self.opened - 1) as f64
                });
                Ok(answer(opened, encode_number))
            }
            "fstat" => {
                arity(payload, 1)?;
                let handle = self.handle(argument(payload, 0, "handle")?)?;
                Ok(answer(handle.and_then(files::fstat), encode_stat))
            }
            "pread" => {
                arity(payload, 3)?;
                let handle = self.handle(argument(payload, 0, "handle")?)?;
                let offset = decode_number(argument(payload, 1, "offset")?)?;
                let size = decode_number(argument(payload, 2, "size")?)?;
                // The window first, as the Node runner: a closed handle with a
                // bad window answers the window.
                let window = files::check_window(offset, size);
                Ok(answer(
                    window
                        .and(handle)
                        .and_then(|file| files::pread(file, offset, size)),
                    encode_bytes,
                ))
            }
            "close" => {
                arity(payload, 1)?;
                let handle = self.slot(argument(payload, 0, "handle")?)?;
                // Closing twice is not an error, as `FileHandle.close()`.
                self.files.remove(&handle);
                Ok(encode_ok(encode_nothing(())))
            }
            "catch" => {
                arity(payload, 1)?;
                Ok(common::catch(argument(payload, 0, "f")?))
            }
            "sandbox" if common::CLOCK => {
                arity(payload, 1)?;
                Ok(common::sandbox(argument(payload, 0, "f")?))
            }
            "now" if common::CLOCK => {
                arity(payload, 0)?;
                Ok(common::now())
            }
            "rm" => {
                arity(payload, 1)?;
                let path = decode_string(argument(payload, 0, "path")?)?;
                Ok(answer(files::rm(&path), encode_nothing))
            }
            _ if COMMANDS.contains(&command.as_str()) => Ok(not_implemented(&command)),
            _ => malformed_command(&command),
        }
    }

    /// The number a handle is. A value that is no handle this host gave is
    /// thrown, as the Node runner's `asFileHandle` does.
    fn slot<A: IVm>(&self, handle: Any<A>) -> Result<u64, Malformed> {
        let number = decode_number(handle)?;
        if number.fract() == 0.0 && number >= 0.0 && number < self.opened as f64 {
            Ok(number as u64)
        } else {
            Err(Malformed(format!(
                "{} is not a file handle",
                js_number(number)
            )))
        }
    }

    /// The open file a handle names, or `EBADF` for one that was closed.
    fn handle<A: IVm>(&self, handle: Any<A>) -> Result<Result<&File, IoError>, Malformed> {
        let slot = self.slot(handle)?;
        Ok(self.files.get(&slot).ok_or_else(files::bad_descriptor))
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
            unstable::{bigint_any, bigint_any_words, string_key},
        },
    };
    use std::io::Cursor;

    type V = Any<Naive>;
    type Host = Native<Cursor<Vec<u8>>, Vec<u8>, Vec<u8>>;

    fn host(input: &[u8]) -> Host {
        Native::new(Cursor::new(input.to_vec()), Vec::new(), Vec::new())
    }

    fn array<const N: usize>(items: [V; N]) -> V {
        items.to_array().to_any()
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
        bigint_any(-59_497)
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
        // the streams are told apart: one write reaches one stream only
        ok(write(&mut h, "stdout"));
        assert_eq!(h.stdout().as_slice(), b"hihi");
        assert_eq!(h.stderr().as_slice(), b"hi");
        h.stdout.clear();
        h.perform(
            string_any("write"),
            array([string_any("stdout"), bigint_any(0)]),
        )
        .unwrap();
        assert!(h.stdout().is_empty());
        let read = |h: &mut Host| ok(h.perform(string_any("read"), array([string_any("stdin")])));
        assert_eq!(read(&mut h), Number::from(97.0).to_any());
        assert_eq!(read(&mut h), Nullish::Null.to_any());
    }

    /// A trailing partial byte is zero-padded in its low bits, as `fromVec` does.
    #[test]
    fn partial_byte() {
        let mut h = host(b"");
        // `vec(1n)(1n)`: the one bit `1`
        ok(h.perform(
            string_any("write"),
            array([string_any("stdout"), bigint_any(1)]),
        ));
        // `vec(9n)(0b1_0000_0001n)` shifted: nine bits, `1 0000 0001`
        ok(h.perform(
            string_any("write"),
            array([string_any("stdout"), bigint_any(0b1_0000_0001)]),
        ));
        assert_eq!(h.stdout().as_slice(), [0x80, 0x80, 0x80]);
    }

    /// A vector of more than one word is read across its words, whole bytes or not.
    #[test]
    fn many_words() {
        let mut h = host(b"");
        let mut put = |v: V| ok(h.perform(string_any("write"), array([string_any("stdout"), v])));
        // nine bytes `01 02 .. 09`: the first bit is `0`, so the value is negative
        put(bigint_any_words(true, &[0x0203_0405_0607_0809, 0x81]));
        // 65 one bits: the last byte is padded to `80`
        put(bigint_any_words(false, &[u64::MAX, 1]));
        let mut expected: Vec<u8> = (1..=9).collect();
        expected.extend([0xff; 8]);
        expected.push(0x80);
        assert_eq!(h.stdout().as_slice(), expected);
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
            throws(w(), array([string_any("stdout"), string_any("hi")])),
            "not a bit vector"
        );
        assert_eq!(
            throws(string_any("wirte"), array([])),
            "`wirte` is not a command"
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
        Native::new(Cursor::new(Vec::new()), Full, Vec::new()).write(false, &[1]);
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

    fn perform<const N: usize>(command: &str, payload: [V; N]) -> Result<V, V> {
        host(b"").perform(string_any(command), array(payload))
    }

    fn thrown<const N: usize>(command: &str, payload: [V; N]) -> String {
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
        let windows: Vec<V> = Array::try_from(ok(perform("readWhole", [at("f")])))
            .unwrap()
            .into_iter()
            .collect();
        assert_eq!(windows, [hi()]);
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

    /// `stat`, `access`, `rename` and `rmdir` through `perform`.
    #[cfg(not(target_family = "wasm"))]
    #[test]
    fn metadata_through_perform() {
        let dir = std::env::temp_dir().join(format!(
            "nanvm-effects-node-metadata-{}",
            std::process::id()
        ));
        let at = |name: &str| string_any(&dir.join(name).to_string_lossy());
        std::fs::create_dir_all(&dir).unwrap();
        let undefined = || Nullish::Undefined.to_any();
        let member = |value: V, name: &str| {
            nanvm_lib::vm::Object::try_from(value)
                .unwrap()
                .own_property(&name.into())
                .unwrap()
        };

        ok(perform("writeFile", [at("a"), hi()]));
        let stat = ok(perform("stat", [at("a")]));
        assert_eq!(member(stat.clone(), "size"), Number::from(2.0).to_any());
        assert_eq!(member(stat.clone(), "isFile"), true.to_any());
        assert_eq!(member(stat, "isDirectory"), false.to_any());
        assert_eq!(ok(perform("access", [at("a")])), undefined());
        assert_eq!(ok(perform("rename", [at("a"), at("b")])), undefined());
        assert_eq!(ok(perform("rm", [at("b")])), undefined());
        assert_eq!(ok(perform("mkdir", [at("d"), undefined()])), undefined());
        assert_eq!(ok(perform("rmdir", [at("d")])), undefined());

        let missing = perform("stat", [at("d")]).unwrap();
        let [tag, error]: [V; 2] = Array::try_from(missing)
            .unwrap()
            .into_iter()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        assert_eq!(tag, string_any("error"));
        let [_, info]: [V; 2] = Array::try_from(error)
            .unwrap()
            .into_iter()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        assert_eq!(member(info, "code"), string_any("ENOENT"));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// `readBytes`, `createExclusive` and `writeExclusive` through `perform`.
    #[cfg(not(target_family = "wasm"))]
    #[test]
    fn exclusive_and_windows_through_perform() {
        let dir = std::env::temp_dir().join(format!(
            "nanvm-effects-node-exclusive-{}",
            std::process::id()
        ));
        let at = |name: &str| string_any(&dir.join(name).to_string_lossy());
        std::fs::create_dir_all(&dir).unwrap();
        let undefined = || Nullish::Undefined.to_any();
        let number = |n: f64| Number::from(n).to_any();

        assert_eq!(ok(perform("createExclusive", [at("a")])), undefined());
        assert_eq!(
            ok(perform("writeExclusive", [at("b"), array([hi(), hi()])])),
            undefined()
        );
        assert_eq!(std::fs::read(dir.join("b")).unwrap(), b"hihi");
        let window = ok(perform("readBytes", [at("b"), number(1.0), number(2.0)]));
        assert_eq!(decode_bytes(window).unwrap(), b"ih");

        // A second create of the same name is EEXIST, answered as an error.
        let again = perform("createExclusive", [at("a")]).unwrap();
        let [tag, _]: [V; 2] = Array::try_from(again)
            .unwrap()
            .into_iter()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        assert_eq!(tag, string_any("error"));
        assert_eq!(thrown("writeExclusive", [at("c"), hi()]), "not an array");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// The `{code?, message}` of an `['error', ['ioError', info]]` answer.
    #[cfg(not(target_family = "wasm"))]
    fn error_info(answer: V) -> V {
        let [tag, error]: [V; 2] = Array::try_from(answer)
            .unwrap()
            .into_iter()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        assert_eq!(tag, string_any("error"));
        let [_, info]: [V; 2] = Array::try_from(error)
            .unwrap()
            .into_iter()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        info
    }

    /// The code of an `['error', ['ioError', {code}]]` answer.
    #[cfg(not(target_family = "wasm"))]
    fn error_code(answer: V) -> V {
        nanvm_lib::vm::Object::try_from(error_info(answer))
            .unwrap()
            .own_property(&"code".into())
            .unwrap()
    }

    /// `open`, `fstat`, `pread` and `close` through one host, which keeps the
    /// handles: an index, never reused, and `EBADF` once closed.
    #[cfg(not(target_family = "wasm"))]
    #[test]
    fn handles_through_perform() {
        let dir =
            std::env::temp_dir().join(format!("nanvm-effects-node-handles-{}", std::process::id()));
        let at = |name: &str| string_any(&dir.join(name).to_string_lossy());
        std::fs::create_dir_all(&dir).unwrap();
        let undefined = || Nullish::Undefined.to_any();
        let number = |n: f64| Number::from(n).to_any();
        let member = |value: V, name: &str| {
            nanvm_lib::vm::Object::try_from(value)
                .unwrap()
                .own_property(&name.into())
                .unwrap()
        };
        ok(perform("writeFile", [at("a"), hi()]));
        let mut h = host(b"");
        let mut run = |command: &str, payload: Vec<V>| {
            h.perform(string_any(command), payload.to_array().to_any())
        };

        let a = ok(run("open", vec![at("a")]));
        assert_eq!(a, number(0.0));
        let stat = ok(run("fstat", vec![a.clone()]));
        assert_eq!(member(stat.clone(), "size"), number(2.0));
        assert_eq!(member(stat, "isFile"), true.to_any());
        let window = |at: f64, size: f64| vec![number(0.0), number(at), number(size)];
        let bytes = |answer: Result<V, V>| decode_bytes(ok(answer)).unwrap();
        assert_eq!(bytes(run("pread", window(0.0, 2.0))), b"hi");
        assert_eq!(bytes(run("pread", window(1.0, 10.0))), b"i");
        assert_eq!(bytes(run("pread", window(5.0, 1.0))), b"");

        // The path is gone, and the handle still reads what it opened.
        std::fs::remove_file(dir.join("a")).unwrap();
        assert_eq!(bytes(run("pread", window(0.0, 2.0))), b"hi");

        // A name that is not there answers `ENOENT` and mints no handle.
        let missing = run("open", vec![at("none")]).unwrap();
        assert_eq!(error_code(missing), string_any("ENOENT"));
        #[cfg(unix)]
        {
            let directory = ok(run("open", vec![string_any(&dir.to_string_lossy())]));
            assert_eq!(directory, number(1.0));
            let stat = ok(run("fstat", vec![directory.clone()]));
            assert_eq!(member(stat, "isDirectory"), true.to_any());
            let read = run("pread", vec![directory.clone(), number(0.0), number(1.0)]).unwrap();
            assert_eq!(error_code(read), string_any("EISDIR"));
            assert_eq!(ok(run("close", vec![directory])), undefined());
        }

        assert_eq!(ok(run("close", vec![a.clone()])), undefined());
        assert_eq!(ok(run("close", vec![a.clone()])), undefined());
        let closed = run("fstat", vec![a.clone()]).unwrap();
        assert_eq!(error_code(closed), string_any("EBADF"));
        let closed = run("pread", window(0.0, 1.0)).unwrap();
        assert_eq!(error_code(closed), string_any("EBADF"));

        // The window is checked before the handle, as the Node runner does.
        let refused = run("pread", vec![a.clone(), number(-1.0), number(1.0)]).unwrap();
        assert_eq!(
            member(error_info(refused), "message"),
            string_any("Offset -1 is negative")
        );

        let thrown = |result: Result<V, V>| decode_string(result.unwrap_err()).unwrap();
        assert_eq!(
            thrown(run("fstat", vec![number(99.0)])),
            "99 is not a file handle"
        );
        assert_eq!(
            thrown(run("close", vec![number(0.5)])),
            "0.5 is not a file handle"
        );
        assert_eq!(
            thrown(run("pread", vec![a, number(0.0)])),
            "missing argument 2, `size`"
        );
        // Closing frees the file: nothing is kept for a handle that is closed.
        assert_eq!(h.files.len(), 0);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    fn thunk(code: nanvm_lib::vm::StaticCode<Naive>) -> V {
        use nanvm_lib::vm::IStaticFunction;
        Naive::static_function(code, 0, [].to_array(), None).to_any()
    }

    #[cfg(not(all(target_family = "wasm", target_os = "unknown")))]
    fn members(value: V, names: [&str; 2]) -> [V; 2] {
        let object = nanvm_lib::vm::Object::try_from(value).unwrap();
        names.map(|name| object.own_property(&name.into()).unwrap())
    }

    /// `catch` answers what the thunk did: `['ok', ['ok', value]]`, and a
    /// throw as `['ok', ['error', thrown]]`, neither ending the run.
    #[test]
    fn catch_answers_what_the_thunk_did() {
        let returned = ok(perform("catch", [thunk(|_, _| Ok(string_any("fine")))]));
        assert_eq!(returned.to_json(), Ok("[\"ok\",\"fine\"]".into()));
        let threw = ok(perform("catch", [thunk(|_, _| Err(string_any("boom")))]));
        assert_eq!(threw.to_json(), Ok("[\"error\",\"boom\"]".into()));
        // A value that is no function throws when it is called, which `catch` catches.
        let not_callable = ok(perform("catch", [string_any("x")]));
        let [tag, _]: [V; 2] = Array::try_from(not_callable)
            .unwrap()
            .into_iter()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        assert_eq!(tag, string_any("error"));
    }

    /// `sandbox` answers `{result, duration}`, the duration a number of
    /// milliseconds that is not negative.
    /// Needs a clock, which `wasm32-unknown-unknown` does not have: `std` panics
    /// on `Instant::now` and `SystemTime::now` there, WASI has them.
    #[cfg(not(all(target_family = "wasm", target_os = "unknown")))]
    #[test]
    fn sandbox_answers_the_result_and_a_duration() {
        for (code, expected) in [
            (
                (|_, _| Ok(string_any("fine"))) as nanvm_lib::vm::StaticCode<Naive>,
                "[\"ok\",\"fine\"]",
            ),
            (|_, _| Err(string_any("boom")), "[\"error\",\"boom\"]"),
        ] {
            let answer = ok(perform("sandbox", [thunk(code)]));
            let [result, duration] = members(answer, ["result", "duration"]);
            assert_eq!(result.to_json(), Ok(expected.into()));
            let milliseconds = f64::from(Number::try_from(duration).unwrap());
            assert!((0.0..60_000.0).contains(&milliseconds));
        }
    }

    /// `now` is whole milliseconds since the epoch, within the test's own bounds.
    /// Needs a clock, which `wasm32-unknown-unknown` does not have: `std` panics
    /// on `Instant::now` and `SystemTime::now` there, WASI has them.
    #[cfg(not(all(target_family = "wasm", target_os = "unknown")))]
    #[test]
    fn now_is_the_epoch_in_milliseconds() {
        let epoch = || {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as f64
        };
        let before = epoch();
        let answer = f64::from(Number::try_from(ok(perform("now", []))).unwrap());
        let after = epoch();
        assert!(before <= answer && answer <= after && answer.fract() == 0.0);
    }

    #[test]
    fn the_thunk_operations_take_exactly_their_arguments() {
        assert_eq!(thrown("catch", []), "missing argument 0, `f`");
    }

    #[cfg(not(all(target_family = "wasm", target_os = "unknown")))]
    #[test]
    fn the_clock_operations_take_exactly_their_arguments() {
        assert_eq!(
            thrown("sandbox", [hi(), hi()]),
            "2 arguments where at most 1 are taken"
        );
        assert_eq!(
            thrown("now", [hi()]),
            "1 arguments where at most 0 are taken"
        );
    }

    /// Without a clock the operations are refused, not trapped.
    #[cfg(all(target_family = "wasm", target_os = "unknown"))]
    #[test]
    fn the_clock_operations_are_not_implemented_without_a_clock() {
        for command in ["sandbox", "now"] {
            assert_eq!(
                perform(command, []).unwrap().to_json(),
                Ok(format!("[\"error\",[\"notImplemented\",\"{command}\"]]"))
            );
        }
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
        assert!(member("path").replace('\\', "/").ends_with("/Cargo.toml"));
        assert_eq!(
            member("id"),
            crate::resolve::path_to_file_url(&member("path"))
        );
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
            .replace('\\', "/")
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
