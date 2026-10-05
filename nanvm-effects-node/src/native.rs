//! The operations over `std`: files, directories and the standard streams.
//!
//! A [`Native`] is generic over its three streams so that it can be proven
//! without touching the process's own; [`Native::stdio`] is the one over the
//! real ones.
//! What each operation answers is what `fjs/effects/node/module.mjs` answers,
//! with the differences the doc of the method names.

use crate::{
    Dirent, FileModule, IoChannel, IoErrorInfo, MakeDirectoryOptions, NotImplemented, Operations,
    ReaddirOptions, WriteConsoles, not_implemented,
};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, ErrorKind, Read, Seek, SeekFrom, Write},
    path::Path,
};

/// The most a file may hold to be read: one `Vec`, which the language caps at
/// 2^17 bytes (`maxLengthBytes` in `fjs/types/bit_vec`). A larger one is
/// refused before it is read, as `readFile` of the Node runner refuses it.
pub const MAX_FILE_SIZE_BYTES: u64 = 1 << 17;

/// A runner over `std`, reading console input from `R` and writing console
/// output to `O` and `E`.
#[derive(Debug)]
pub struct Native<R, O, E> {
    stdin: R,
    stdout: O,
    stderr: E,
}

impl Native<io::Stdin, io::Stdout, io::Stderr> {
    /// The runner over the real standard streams.
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

/// The Node error code of a failure, where `std` has a kind for it: what a
/// program reads from `IoError.code` to tell a missing file from a refused one.
fn code(kind: ErrorKind) -> Option<&'static str> {
    match kind {
        ErrorKind::NotFound => Some("ENOENT"),
        ErrorKind::PermissionDenied => Some("EACCES"),
        ErrorKind::AlreadyExists => Some("EEXIST"),
        ErrorKind::NotADirectory => Some("ENOTDIR"),
        ErrorKind::IsADirectory => Some("EISDIR"),
        ErrorKind::DirectoryNotEmpty => Some("ENOTEMPTY"),
        _ => None,
    }
}

/// A failed call as the error channel carries it: the code where there is
/// one, and a message naming the call and the path.
fn failure(error: &io::Error, call: &str, path: &str) -> IoChannel {
    IoChannel::IoError(IoErrorInfo {
        code: code(error.kind()).map(str::to_string),
        message: format!("{error}, {call} '{path}'"),
    })
}

/// A failure that is not the host's: an argument the host would reject.
fn refusal(code: &str, message: String) -> IoChannel {
    IoChannel::IoError(IoErrorInfo {
        code: Some(code.to_string()),
        message,
    })
}

/// `normalize` of `fjs/path`, for the paths a directory read answers: `\` is
/// `/`, empty and `.` segments vanish, `..` cancels the segment before it or
/// is kept where nothing is left to cancel, and a root, `/` or `//`, stays and
/// absorbs the `..` that would climb past it. A drive letter is an ordinary
/// segment here.
pub fn normalize(path: &str) -> String {
    let path = path.replace('\\', "/");
    let root = if path.starts_with("//") && !path.starts_with("///") {
        "//"
    } else if path.starts_with('/') {
        "/"
    } else {
        ""
    };
    let mut segments: Vec<&str> = Vec::new();
    for segment in path.split('/') {
        match segment {
            "" | "." => {}
            ".." => match segments.last() {
                Some(&last) if last != ".." => {
                    segments.pop();
                }
                _ if root.is_empty() => segments.push(".."),
                _ => {}
            },
            _ => segments.push(segment),
        }
    }
    format!("{root}{}", segments.join("/"))
}

/// The entries of one directory, in byte order of their names, as `Dirent`s
/// with `parent` as their parent.
fn entries(directory: &str, parent: &str) -> io::Result<Vec<Dirent>> {
    let mut found = Vec::new();
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let kind = entry.file_type()?;
        found.push(Dirent {
            name: entry.file_name().to_string_lossy().into_owned(),
            parent_path: parent.to_string(),
            is_file: kind.is_file(),
            is_directory: kind.is_dir(),
        });
    }
    found.sort_by(|a, b| a.name.as_bytes().cmp(b.name.as_bytes()));
    Ok(found)
}

/// Every entry below `path`, level by level: the entries of `path`, then those
/// of each directory among them in the order found, as `readdir` with
/// `recursive` answers.
fn tree(path: &str) -> io::Result<Vec<Dirent>> {
    let mut found = Vec::new();
    let mut queue = vec![path.to_string()];
    let mut next = 0;
    while next < queue.len() {
        let directory = queue[next].clone();
        next += 1;
        for entry in entries(&directory, &normalize(&directory))? {
            if entry.is_directory {
                queue.push(
                    Path::new(&directory)
                        .join(&entry.name)
                        .to_string_lossy()
                        .into_owned(),
                );
            }
            found.push(entry);
        }
    }
    Ok(found)
}

/// A byte offset: a whole, non-negative number that a file can hold.
fn offset(value: f64) -> Option<u64> {
    (value.is_finite() && value >= 0.0 && value.fract() == 0.0 && value < u64::MAX as f64)
        .then_some(value as u64)
}

impl<R: Read, O: Write, E: Write> Operations for Native<R, O, E> {
    /// `recursive` is `create_dir_all`, which answers nothing for a directory
    /// that exists, as `mkdir` with `recursive` does; without it an existing
    /// directory is `EEXIST`.
    fn mkdir(
        &mut self,
        path: String,
        options: Option<MakeDirectoryOptions>,
    ) -> Result<(), IoChannel> {
        match options {
            Some(MakeDirectoryOptions) => fs::create_dir_all(&path),
            None => fs::create_dir(&path),
        }
        .map_err(|e| failure(&e, "mkdir", &path))
    }

    /// A file over [`MAX_FILE_SIZE_BYTES`] is refused, with no code, before it is read.
    fn read_file(&mut self, path: String) -> Result<Vec<u8>, IoChannel> {
        let size = fs::metadata(&path)
            .map_err(|e| failure(&e, "stat", &path))?
            .len();
        if size > MAX_FILE_SIZE_BYTES {
            return Err(IoChannel::IoError(IoErrorInfo {
                code: None,
                message: format!(
                    "File size {size} exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES} bytes: '{path}'"
                ),
            }));
        }
        fs::read(&path).map_err(|e| failure(&e, "open", &path))
    }

    /// Not implemented yet: module resolution is `todo/nanvm-effects-node.md`'s own task.
    fn resolve_file_module(
        &mut self,
        _: String,
        _: Option<String>,
    ) -> Result<FileModule, IoChannel> {
        not_implemented("resolveFileModule")
    }

    /// The entries of each directory are in byte order of their names, where
    /// the operating system's order is unspecified, and a recursive read lists a
    /// directory's entries before those of any directory below it.
    fn readdir(&mut self, path: String, options: ReaddirOptions) -> Result<Vec<Dirent>, IoChannel> {
        if options.recursive {
            tree(&path)
        } else {
            entries(&path, &normalize(&path))
        }
        .map_err(|e| failure(&e, "scandir", &path))
    }

    /// Creates the file or truncates it.
    fn write_file(&mut self, path: String, data: Vec<u8>) -> Result<(), IoChannel> {
        fs::write(&path, data).map_err(|e| failure(&e, "open", &path))
    }

    /// Writes into a file that exists, at `offset`, leaving the rest as it is.
    /// An offset that is not a whole, non-negative number is `ERR_OUT_OF_RANGE`.
    fn write_bytes(&mut self, path: String, offset_: f64, data: Vec<u8>) -> Result<(), IoChannel> {
        let Some(at) = offset(offset_) else {
            return Err(refusal(
                "ERR_OUT_OF_RANGE",
                format!("The value of \"position\" is out of range: {offset_}"),
            ));
        };
        let mut file: File = OpenOptions::new()
            .read(true)
            .write(true)
            .open(&path)
            .map_err(|e| failure(&e, "open", &path))?;
        file.seek(SeekFrom::Start(at))
            .and_then(|_| file.write_all(&data))
            .map_err(|e| failure(&e, "write", &path))
    }

    /// Removes a file or a link, and refuses a directory.
    fn rm(&mut self, path: String) -> Result<(), IoChannel> {
        fs::remove_file(&path).map_err(|e| failure(&e, "rm", &path))
    }

    /// Writes all of `data` and flushes, so that it is out when this answers.
    /// The operation has no failure of its own, and a stream that refuses the
    /// data ends the process, as a stream error nobody handles ends Node's.
    fn write(&mut self, stream: WriteConsoles, data: Vec<u8>) -> Result<(), NotImplemented> {
        match stream {
            WriteConsoles::Stdout => self
                .stdout
                .write_all(&data)
                .and_then(|_| self.stdout.flush()),
            WriteConsoles::Stderr => self
                .stderr
                .write_all(&data)
                .and_then(|_| self.stderr.flush()),
        }
        .expect("a console stream refused a write");
        Ok(())
    }

    /// The next byte of input, and `None` at its end. A read that fails ends
    /// the process, as for `write`.
    fn read(&mut self) -> Result<Option<f64>, NotImplemented> {
        let mut byte = [0u8];
        loop {
            match self.stdin.read(&mut byte) {
                Ok(0) => return Ok(None),
                Ok(_) => return Ok(Some(f64::from(byte[0]))),
                Err(e) if e.kind() == ErrorKind::Interrupted => {}
                Err(e) => panic!("console input failed: {e}"),
            }
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use std::io::Cursor;

    type Runner = Native<Cursor<Vec<u8>>, Vec<u8>, Vec<u8>>;

    fn runner(input: &[u8]) -> Runner {
        Native::new(Cursor::new(input.to_vec()), Vec::new(), Vec::new())
    }

    /// `normalize` agrees with `fjs/path`'s on the cases it was written from.
    #[test]
    fn normalizing() {
        for (path, expected) in [
            (".", ""),
            ("", ""),
            ("a/", "a"),
            ("./a", "a"),
            ("a//b", "a/b"),
            ("/a/./b", "/a/b"),
            ("/", "/"),
            ("a/../b", "b"),
            ("..", ".."),
            ("../a", "../a"),
            ("a/b/..", "a"),
            ("/..", "/"),
            ("/a/..", "/"),
            ("//a", "//a"),
            ("///a", "/a"),
            ("//", "//"),
            ("//a/../b", "//b"),
            ("a\\b", "a/b"),
            ("/a/../../b", "/b"),
            ("a/../..", ".."),
            ("../..", "../.."),
        ] {
            assert_eq!(normalize(path), expected, "{path:?}");
        }
    }

    #[test]
    fn offsets() {
        assert_eq!(offset(0.0), Some(0));
        assert_eq!(offset(5.0), Some(5));
        assert_eq!(offset(-1.0), None);
        assert_eq!(offset(0.5), None);
        assert_eq!(offset(f64::NAN), None);
        assert_eq!(offset(f64::INFINITY), None);
        assert_eq!(offset(1e30), None);
    }

    #[test]
    fn codes() {
        assert_eq!(code(ErrorKind::NotFound), Some("ENOENT"));
        assert_eq!(code(ErrorKind::PermissionDenied), Some("EACCES"));
        assert_eq!(code(ErrorKind::AlreadyExists), Some("EEXIST"));
        assert_eq!(code(ErrorKind::NotADirectory), Some("ENOTDIR"));
        assert_eq!(code(ErrorKind::IsADirectory), Some("EISDIR"));
        assert_eq!(code(ErrorKind::DirectoryNotEmpty), Some("ENOTEMPTY"));
        assert_eq!(code(ErrorKind::Other), None);
    }

    /// The console writes both streams and reads input a byte at a time.
    #[test]
    fn console() {
        let mut r = runner(b"ab");
        assert_eq!(r.write(WriteConsoles::Stdout, b"out".to_vec()), Ok(()));
        assert_eq!(r.write(WriteConsoles::Stderr, b"err".to_vec()), Ok(()));
        assert_eq!(
            (r.stdout.as_slice(), r.stderr.as_slice()),
            (&b"out"[..], &b"err"[..])
        );
        assert_eq!(r.read(), Ok(Some(97.0)));
        assert_eq!(r.read(), Ok(Some(98.0)));
        assert_eq!(r.read(), Ok(None));
        assert_eq!(r.read(), Ok(None));
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
        let mut r = Native::new(Once(false), Vec::new(), Vec::new());
        assert_eq!(r.read(), Ok(Some(7.0)));
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
        let mut r = Native::new(Cursor::new(vec![]), Full, Vec::new());
        let _ = r.write(WriteConsoles::Stdout, vec![1]);
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
        let mut r = Native::new(Broken, Vec::new(), Vec::new());
        let _ = r.read();
    }

    #[test]
    fn module_resolution_is_not_implemented() {
        assert_eq!(
            runner(b"").resolve_file_module("a".into(), None),
            Err(IoChannel::NotImplemented("resolveFileModule".into()))
        );
    }

    /// The operations against a real directory, which a WebAssembly host does
    /// not give a test.
    #[cfg(not(target_family = "wasm"))]
    mod files {
        use super::*;
        use std::sync::atomic::{AtomicUsize, Ordering};

        /// A fresh directory under the system's, removed when dropped.
        struct Scratch(std::path::PathBuf);

        impl Scratch {
            fn new() -> Self {
                static NEXT: AtomicUsize = AtomicUsize::new(0);
                let n = NEXT.fetch_add(1, Ordering::Relaxed);
                let path = std::env::temp_dir()
                    .join(format!("nanvm-effects-node-{}-{n}", std::process::id()));
                fs::create_dir_all(&path).unwrap();
                Self(path)
            }
            fn at(&self, name: &str) -> String {
                self.0.join(name).to_string_lossy().into_owned()
            }
        }

        impl Drop for Scratch {
            fn drop(&mut self) {
                let _ = fs::remove_dir_all(&self.0);
            }
        }

        fn code_of<T: std::fmt::Debug>(r: Result<T, IoChannel>) -> Option<String> {
            match r {
                Err(IoChannel::IoError(info)) => info.code,
                other => panic!("not an IO error: {other:?}"),
            }
        }

        #[test]
        fn write_read_and_rm() {
            let dir = Scratch::new();
            let mut r = runner(b"");
            let file = dir.at("a.bin");
            assert_eq!(r.write_file(file.clone(), vec![1, 2, 3]), Ok(()));
            assert_eq!(r.read_file(file.clone()), Ok(vec![1, 2, 3]));
            assert_eq!(r.write_file(file.clone(), vec![9]), Ok(()));
            assert_eq!(r.read_file(file.clone()), Ok(vec![9]));
            assert_eq!(r.rm(file.clone()), Ok(()));
            assert_eq!(code_of(r.read_file(file.clone())), Some("ENOENT".into()));
            assert_eq!(code_of(r.rm(file)), Some("ENOENT".into()));
        }

        #[test]
        fn read_refuses_a_file_over_a_vec() {
            let dir = Scratch::new();
            let mut r = runner(b"");
            let file = dir.at("big");
            assert_eq!(
                r.write_file(file.clone(), vec![0; MAX_FILE_SIZE_BYTES as usize]),
                Ok(())
            );
            assert_eq!(r.read_file(file.clone()).map(|v| v.len()), Ok(1 << 17));
            assert_eq!(
                r.write_bytes(file.clone(), (1 << 17) as f64, vec![0]),
                Ok(())
            );
            let Err(IoChannel::IoError(info)) = r.read_file(file) else {
                panic!("a file over the limit was read")
            };
            assert_eq!(info.code, None);
            assert!(
                info.message.starts_with("File size 131073 exceeds"),
                "{}",
                info.message
            );
        }

        #[test]
        fn rm_refuses_a_directory() {
            let dir = Scratch::new();
            let mut r = runner(b"");
            assert!(r.rm(dir.at("")).is_err());
        }

        #[test]
        fn mkdir() {
            let dir = Scratch::new();
            let mut r = runner(b"");
            let nested = dir.at("a/b/c");
            assert_eq!(
                code_of(r.mkdir(nested.clone(), None)),
                Some("ENOENT".into())
            );
            assert_eq!(r.mkdir(nested.clone(), Some(MakeDirectoryOptions)), Ok(()));
            assert_eq!(r.mkdir(nested.clone(), Some(MakeDirectoryOptions)), Ok(()));
            assert_eq!(code_of(r.mkdir(nested, None)), Some("EEXIST".into()));
            assert_eq!(r.mkdir(dir.at("d"), None), Ok(()));
        }

        #[test]
        fn write_bytes_in_place() {
            let dir = Scratch::new();
            let mut r = runner(b"");
            let file = dir.at("a");
            assert_eq!(
                code_of(r.write_bytes(file.clone(), 0.0, vec![1])),
                Some("ENOENT".into())
            );
            r.write_file(file.clone(), vec![1, 2, 3, 4]).unwrap();
            assert_eq!(r.write_bytes(file.clone(), 1.0, vec![9, 8]), Ok(()));
            assert_eq!(r.read_file(file.clone()), Ok(vec![1, 9, 8, 4]));
            assert_eq!(r.write_bytes(file.clone(), 6.0, vec![5]), Ok(()));
            assert_eq!(r.read_file(file.clone()), Ok(vec![1, 9, 8, 4, 0, 0, 5]));
            assert_eq!(
                code_of(r.write_bytes(file.clone(), -1.0, vec![1])),
                Some("ERR_OUT_OF_RANGE".into())
            );
            assert_eq!(
                code_of(r.write_bytes(file, 0.5, vec![1])),
                Some("ERR_OUT_OF_RANGE".into())
            );
        }

        /// A directory read is sorted, and a recursive one goes level by level.
        #[test]
        fn readdir() {
            let dir = Scratch::new();
            let mut r = runner(b"");
            for d in ["b", "a", "a/x", "b/y", "a/x/deep"] {
                r.mkdir(dir.at(d), None).unwrap();
            }
            for f in ["z", "a/f", "b/g", "a/x/deep/h"] {
                r.write_file(dir.at(f), vec![]).unwrap();
            }
            let root = normalize(&dir.at(""));
            let dirent = |parent: &str, name: &str, is_file: bool| Dirent {
                name: name.into(),
                parent_path: normalize(&format!("{root}/{parent}")),
                is_file,
                is_directory: !is_file,
            };
            assert_eq!(
                r.readdir(dir.at(""), ReaddirOptions { recursive: false }),
                Ok(vec![
                    dirent("", "a", false),
                    dirent("", "b", false),
                    dirent("", "z", true)
                ])
            );
            assert_eq!(
                r.readdir(dir.at(""), ReaddirOptions { recursive: true }),
                Ok(vec![
                    dirent("", "a", false),
                    dirent("", "b", false),
                    dirent("", "z", true),
                    dirent("a", "f", true),
                    dirent("a", "x", false),
                    dirent("b", "g", true),
                    dirent("b", "y", false),
                    dirent("a/x", "deep", false),
                    dirent("a/x/deep", "h", true),
                ])
            );
            assert_eq!(
                code_of(r.readdir(dir.at("none"), ReaddirOptions { recursive: false })),
                Some("ENOENT".into())
            );
            assert!(
                r.readdir(dir.at("z"), ReaddirOptions { recursive: false })
                    .is_err()
            );
        }
    }
}
