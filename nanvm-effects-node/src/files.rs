//! The file and directory operations over `std`.
//!
//! What each answers is what `fjs/effects/node/module.mjs` answers, with the
//! differences the doc of the function names. A failure is an [`IoError`], the
//! `ioError` the language reads.

use std::{
    fs::{self, File, OpenOptions},
    io::{self, ErrorKind, Seek, SeekFrom, Write},
    path::Path,
};

/// A failed operation as the error channel carries it: the Node error code
/// where there is one, and a message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IoError {
    pub code: Option<String>,
    pub message: String,
}

/// An entry of a directory, as Node's `Dirent`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Dirent {
    pub name: String,
    pub parent_path: String,
    pub is_file: bool,
    pub is_directory: bool,
}

/// The most a file may hold to be read: one `Vec`, which the language caps at
/// 2^17 bytes (`maxLengthBytes` in `fjs/types/bit_vec`). A larger one is
/// refused before it is read, as `readFile` of the Node runner refuses it.
pub const MAX_FILE_SIZE_BYTES: u64 = 1 << 17;

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
fn failure(error: &io::Error, call: &str, path: &str) -> IoError {
    IoError {
        code: code(error.kind()).map(str::to_string),
        message: format!("{error}, {call} '{path}'"),
    }
}

/// A failure that is not the host's: an argument the host would reject.
fn refusal(code: &str, message: String) -> IoError {
    IoError {
        code: Some(code.to_string()),
        message,
    }
}

/// `normalize` of `fjs/path`, for the paths a directory read answers: `\` is
/// `/`, empty and `.` segments vanish, `..` cancels the segment before it or
/// is kept where nothing is left to cancel, and a root, `/`, `//` or a drive's
/// `C:/`, stays and absorbs the `..` that would climb past it. A bare `C:` and
/// the drive-relative `C:a` are ordinary segments, as they are there.
pub fn normalize(path: &str) -> String {
    let path = path.replace('\\', "/");
    let bytes = path.as_bytes();
    let (root, rest) = if bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && bytes[2] == b'/'
    {
        (&path[..3], &path[3..])
    } else if path.starts_with("//") && !path.starts_with("///") {
        ("//", &path[2..])
    } else if let Some(rest) = path.strip_prefix('/') {
        ("/", rest)
    } else {
        ("", &path[..])
    };
    let mut segments: Vec<&str> = Vec::new();
    for segment in rest.split('/') {
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
    let mut queue = [path.to_string()].to_vec();
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

/// `recursive` is `create_dir_all`, which answers nothing for a directory that
/// exists, as `mkdir` with `recursive` does; without it an existing directory
/// is `EEXIST`.
pub fn mkdir(path: &str, recursive: bool) -> Result<(), IoError> {
    // `create_dir_all("")` is `Ok`, creating nothing: an empty path names
    // nothing, and Node answers `ENOENT` for it, as `create_dir` does.
    if path.is_empty() {
        return Err(failure(&ErrorKind::NotFound.into(), "mkdir", path));
    }
    if recursive {
        fs::create_dir_all(path)
    } else {
        fs::create_dir(path)
    }
    .map_err(|e| failure(&e, "mkdir", path))
}

/// A file over [`MAX_FILE_SIZE_BYTES`] is refused, with no code, before it is read.
pub fn read_file(path: &str) -> Result<Vec<u8>, IoError> {
    let size = fs::metadata(path)
        .map_err(|e| failure(&e, "stat", path))?
        .len();
    if size > MAX_FILE_SIZE_BYTES {
        return Err(IoError {
            code: None,
            message: format!(
                "File size {size} exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES} bytes: '{path}'"
            ),
        });
    }
    fs::read(path).map_err(|e| failure(&e, "open", path))
}

/// The entries of each directory are in byte order of their names, where the
/// operating system's order is unspecified, and a recursive read lists a
/// directory's entries before those of any directory below it.
pub fn readdir(path: &str, recursive: bool) -> Result<Vec<Dirent>, IoError> {
    if recursive {
        tree(path)
    } else {
        entries(path, &normalize(path))
    }
    .map_err(|e| failure(&e, "scandir", path))
}

/// Creates the file or truncates it.
pub fn write_file(path: &str, data: &[u8]) -> Result<(), IoError> {
    fs::write(path, data).map_err(|e| failure(&e, "open", path))
}

/// Writes into a file that exists, at `at`, leaving the rest as it is. An
/// offset that is not a whole, non-negative number is `ERR_OUT_OF_RANGE`.
pub fn write_bytes(path: &str, at: f64, data: &[u8]) -> Result<(), IoError> {
    let Some(at) = offset(at) else {
        return Err(refusal(
            "ERR_OUT_OF_RANGE",
            format!("The value of \"position\" is out of range: {at}"),
        ));
    };
    let mut file: File = OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
        .map_err(|e| failure(&e, "open", path))?;
    file.seek(SeekFrom::Start(at))
        .and_then(|_| file.write_all(data))
        .map_err(|e| failure(&e, "write", path))
}

/// Removes a file or a link, and refuses a directory with `ERR_FS_EISDIR`, the
/// code `rm` without `recursive` gives on Node, where `remove_file` would
/// answer what the platform does.
pub fn rm(path: &str) -> Result<(), IoError> {
    if fs::symlink_metadata(path).is_ok_and(|m| m.is_dir()) {
        return Err(refusal(
            "ERR_FS_EISDIR",
            format!("Path is a directory: rm returned EISDIR (is a directory) {path}"),
        ));
    }
    fs::remove_file(path).map_err(|e| failure(&e, "rm", path))
}

#[cfg(test)]
mod test {
    use super::*;

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
            ("C:/", "C:/"),
            ("C:", "C:"),
            ("C:a", "C:a"),
            ("C:a/b", "C:a/b"),
            ("c:/x", "c:/x"),
            ("C://a", "C:/a"),
            ("C:/..", "C:/"),
            ("C:/a/../..", "C:/"),
            ("C:\\a\\..", "C:/"),
            ("C:/a/./b/", "C:/a/b"),
            ("1:/a", "1:/a"),
            ("CC:/a", "CC:/a"),
            ("//C:/a", "//C:/a"),
            ("/C:/a", "/C:/a"),
        ] {
            assert_eq!(normalize(path), expected, "{path:?}");
        }
    }

    /// An empty path names nothing, with or without `recursive`.
    #[test]
    fn mkdir_of_an_empty_path() {
        for recursive in [false, true] {
            assert_eq!(code_of(mkdir("", recursive)), Some("ENOENT".into()));
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

    fn code_of<T: std::fmt::Debug>(r: Result<T, IoError>) -> Option<String> {
        r.unwrap_err().code
    }

    /// The operations against a real directory, which a WebAssembly host does
    /// not give a test.
    #[cfg(not(target_family = "wasm"))]
    mod directory {
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

        #[test]
        fn write_read_and_rm() {
            let dir = Scratch::new();
            let file = dir.at("a.bin");
            assert_eq!(write_file(&file, &[1, 2, 3]), Ok(()));
            assert_eq!(read_file(&file), Ok([1, 2, 3].to_vec()));
            assert_eq!(write_file(&file, &[9]), Ok(()));
            assert_eq!(read_file(&file), Ok([9].to_vec()));
            assert_eq!(rm(&file), Ok(()));
            assert_eq!(code_of(read_file(&file)), Some("ENOENT".into()));
            assert_eq!(code_of(rm(&file)), Some("ENOENT".into()));
        }

        #[test]
        fn read_refuses_a_file_over_a_vec() {
            let dir = Scratch::new();
            let file = dir.at("big");
            assert_eq!(
                write_file(&file, &[0; MAX_FILE_SIZE_BYTES as usize]),
                Ok(())
            );
            assert_eq!(read_file(&file).map(|v| v.len()), Ok(1 << 17));
            assert_eq!(write_bytes(&file, (1 << 17) as f64, &[0]), Ok(()));
            let error = read_file(&file).unwrap_err();
            assert_eq!(error.code, None);
            assert!(
                error.message.starts_with("File size 131073 exceeds"),
                "{}",
                error.message
            );
        }

        #[test]
        fn rm_refuses_a_directory() {
            let dir = Scratch::new();
            assert_eq!(code_of(rm(&dir.at(""))), Some("ERR_FS_EISDIR".into()));
            assert_eq!(code_of(rm(&dir.at("none"))), Some("ENOENT".into()));
        }

        #[test]
        fn mkdir_nested() {
            let dir = Scratch::new();
            let nested = dir.at("a/b/c");
            assert_eq!(code_of(mkdir(&nested, false)), Some("ENOENT".into()));
            assert_eq!(mkdir(&nested, true), Ok(()));
            assert_eq!(mkdir(&nested, true), Ok(()));
            assert_eq!(code_of(mkdir(&nested, false)), Some("EEXIST".into()));
            assert_eq!(mkdir(&dir.at("d"), false), Ok(()));
        }

        #[test]
        fn write_bytes_in_place() {
            let dir = Scratch::new();
            let file = dir.at("a");
            assert_eq!(
                code_of(write_bytes(&file, 0.0, &[1])),
                Some("ENOENT".into())
            );
            write_file(&file, &[1, 2, 3, 4]).unwrap();
            assert_eq!(write_bytes(&file, 1.0, &[9, 8]), Ok(()));
            assert_eq!(read_file(&file), Ok([1, 9, 8, 4].to_vec()));
            assert_eq!(write_bytes(&file, 6.0, &[5]), Ok(()));
            assert_eq!(read_file(&file), Ok([1, 9, 8, 4, 0, 0, 5].to_vec()));
            assert_eq!(
                code_of(write_bytes(&file, -1.0, &[1])),
                Some("ERR_OUT_OF_RANGE".into())
            );
            assert_eq!(
                code_of(write_bytes(&file, 0.5, &[1])),
                Some("ERR_OUT_OF_RANGE".into())
            );
        }

        /// A directory read is sorted, and a recursive one goes level by level.
        #[test]
        fn readdir_order() {
            let dir = Scratch::new();
            for d in ["b", "a", "a/x", "b/y", "a/x/deep"] {
                mkdir(&dir.at(d), false).unwrap();
            }
            for f in ["z", "a/f", "b/g", "a/x/deep/h"] {
                write_file(&dir.at(f), &[]).unwrap();
            }
            let root = normalize(&dir.at(""));
            let dirent = |parent: &str, name: &str, is_file: bool| Dirent {
                name: name.into(),
                parent_path: normalize(&format!("{root}/{parent}")),
                is_file,
                is_directory: !is_file,
            };
            assert_eq!(
                readdir(&dir.at(""), false).unwrap(),
                [
                    dirent("", "a", false),
                    dirent("", "b", false),
                    dirent("", "z", true)
                ]
            );
            assert_eq!(
                readdir(&dir.at(""), true).unwrap(),
                [
                    dirent("", "a", false),
                    dirent("", "b", false),
                    dirent("", "z", true),
                    dirent("a", "f", true),
                    dirent("a", "x", false),
                    dirent("b", "g", true),
                    dirent("b", "y", false),
                    dirent("a/x", "deep", false),
                    dirent("a/x/deep", "h", true),
                ]
            );
            assert_eq!(
                code_of(readdir(&dir.at("none"), false)),
                Some("ENOENT".into())
            );
            assert!(readdir(&dir.at("z"), false).is_err());
        }
    }
}
