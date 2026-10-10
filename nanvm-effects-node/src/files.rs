//! The file and directory operations over `std`.
//!
//! What each answers is what `fjs/effects/node/module.mjs` answers, with the
//! differences the doc of the function names. A failure is an [`IoError`], the
//! `ioError` the language reads.

use std::{
    fs::{self, File, OpenOptions},
    io::{self, ErrorKind, Read, Seek, SeekFrom, Write},
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
/// 2^17 bytes (`maxLengthBytes` in `fjs/types/bit_vec`). Metadata can refuse a
/// larger file before reading; the read also checks the bytes actually returned.
pub const MAX_FILE_SIZE_BYTES: u64 = 1 << 17;

/// `maxOffset` in `fjs/effects/node/module.f.mjs`: `Number.MAX_SAFE_INTEGER`.
const MAX_OFFSET: u64 = (1 << 53) - 1;

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
        ErrorKind::ReadOnlyFilesystem => Some("EROFS"),
        ErrorKind::StorageFull => Some("ENOSPC"),
        _ => None,
    }
}

/// Raw codes carry distinctions `ErrorKind` loses, including `EPERM` versus
/// `EACCES`, descriptor exhaustion and symlink loops. Keep the numeric ABI
/// scoped to its target; these are not portable POSIX numbers. Full parity is
/// tracked in `nanvm-effects-node/todo/filesystem-error-codes.md`.
fn raw_code(raw: i32) -> Option<&'static str> {
    // Linux asm-generic errno ABI, used by the native Linux targets in CI.
    #[cfg(all(
        target_os = "linux",
        any(target_arch = "x86", target_arch = "x86_64", target_arch = "aarch64")
    ))]
    let codes: &[(i32, &str)] = &[
        (1, "EPERM"),
        (5, "EIO"),
        (23, "ENFILE"),
        (24, "EMFILE"),
        (28, "ENOSPC"),
        (30, "EROFS"),
        (40, "ELOOP"),
    ];
    // Darwin bsd/sys/errno.h.
    #[cfg(target_os = "macos")]
    let codes: &[(i32, &str)] = &[
        (1, "EPERM"),
        (5, "EIO"),
        (23, "ENFILE"),
        (24, "EMFILE"),
        (28, "ENOSPC"),
        (30, "EROFS"),
        (62, "ELOOP"),
    ];
    // Win32 system errors, translated as libuv's src/win/error.c does.
    #[cfg(target_os = "windows")]
    let codes: &[(i32, &str)] = &[
        (4, "EMFILE"),
        (5, "EPERM"),
        (19, "EROFS"),
        (39, "ENOSPC"),
        (112, "ENOSPC"),
        (1117, "EIO"),
        (1314, "EPERM"),
        (1921, "ELOOP"),
    ];
    #[cfg(not(any(
        all(
            target_os = "linux",
            any(target_arch = "x86", target_arch = "x86_64", target_arch = "aarch64")
        ),
        target_os = "macos",
        target_os = "windows"
    )))]
    let codes: &[(i32, &str)] = &[];
    codes
        .iter()
        .find_map(|&(number, name)| (raw == number).then_some(name))
}

/// A failed call as the error channel carries it: the code where there is
/// one, and a message naming the call and the path.
pub(crate) fn failure(error: &io::Error, call: &str, path: &str) -> IoError {
    IoError {
        code: error
            .raw_os_error()
            .and_then(raw_code)
            .or_else(|| code(error.kind()))
            .map(str::to_string),
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
            // The runner uses fs.promises.readdir with withFileTypes, not
            // callback readdir: symlinks are listed but not traversed.
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

/// A byte offset within the shared positional-I/O safe integer range.
fn offset(value: f64) -> Option<u64> {
    ((0.0..=MAX_OFFSET as f64).contains(&value) && value.fract() == 0.0).then_some(value as u64)
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

/// A file over [`MAX_FILE_SIZE_BYTES`] is refused, with no code. Metadata
/// rejects a known oversized file before reading, but cannot bound the read:
/// a file may grow, and virtual files may report a size of zero.
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
    let file = File::open(path).map_err(|e| failure(&e, "open", path))?;
    read_bounded(path, file)
}

/// Read at most one byte beyond a `Vec`: that extra byte distinguishes a
/// complete value at the limit from an oversized value, never a truncated success.
fn read_bounded(path: &str, reader: impl Read) -> Result<Vec<u8>, IoError> {
    let mut bytes = Vec::new();
    reader
        .take(MAX_FILE_SIZE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| failure(&e, "read", path))?;
    if bytes.len() as u64 > MAX_FILE_SIZE_BYTES {
        return Err(IoError {
            code: None,
            message: format!(
                "File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES} bytes: '{path}'"
            ),
        });
    }
    Ok(bytes)
}

/// A whole file as `readWhole` answers it: windows of one `Vec` each, so a
/// file of any size is read. A path that names no regular file is refused
/// before it is opened, with `notAFileCode` and `notAFileMessage` of
/// `fjs/effects/node/module.f.mjs`: a FIFO with no writer would hold the open.
pub fn read_whole(path: &str) -> Result<Vec<Vec<u8>>, IoError> {
    let metadata = fs::metadata(path).map_err(|e| failure(&e, "stat", path))?;
    if !metadata.is_file() {
        return Err(refusal(
            "ERR_NOT_A_FILE",
            format!("{path} is not a regular file"),
        ));
    }
    let file = File::open(path).map_err(|e| failure(&e, "open", path))?;
    read_windows(path, file)
}

/// Every window is [`MAX_FILE_SIZE_BYTES`] but the last, which is shorter and
/// never empty: an empty file is no windows, as the Node runner answers.
fn read_windows(path: &str, mut reader: impl Read) -> Result<Vec<Vec<u8>>, IoError> {
    let mut bytes = Vec::new();
    reader
        .read_to_end(&mut bytes)
        .map_err(|e| failure(&e, "read", path))?;
    Ok(bytes
        .chunks(MAX_FILE_SIZE_BYTES as usize)
        .map(<[u8]>::to_vec)
        .collect())
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

/// Syncs `file` before it is closed, so an error the filesystem would report
/// only at the close, a delayed `EIO` or `ENOSPC`, is reported. A file that
/// cannot be synced at all, a pipe, a terminal or a device such as `/dev/null`,
/// answers `EINVAL` or is unsupported, and has nothing to flush: that is not a
/// failure (`todo/close-errors.md`).
fn sync(file: &File) -> io::Result<()> {
    match file.sync_all() {
        Err(e) if matches!(e.kind(), ErrorKind::InvalidInput | ErrorKind::Unsupported) => Ok(()),
        result => result,
    }
}

/// Creates the file or truncates it.
pub fn write_file(path: &str, data: &[u8]) -> Result<(), IoError> {
    let mut file = File::create(path).map_err(|e| failure(&e, "open", path))?;
    file.write_all(data)
        .map_err(|e| failure(&e, "write", path))?;
    sync(&file).map_err(|e| failure(&e, "close", path))
}

/// Writes into a file that exists, at `at`, leaving the rest as it is. An
/// offset outside the safe non-negative integer range is `ERR_OUT_OF_RANGE`,
/// refused before the file is opened. Empty data still opens the path, but
/// does not seek or write, as the Node runner skips its write loop.
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
    if data.is_empty() {
        return Ok(());
    }
    file.seek(SeekFrom::Start(at))
        .and_then(|_| file.write_all(data))
        .map_err(|e| failure(&e, "write", path))?;
    sync(&file).map_err(|e| failure(&e, "close", path))
}

/// A number as JavaScript spells it in a message: `NaN`, `Infinity`, and the
/// exponent form at and beyond `1e21` and below `1e-6`, where Rust would write
/// every digit. Otherwise it is Rust's shortest spelling, which differs from
/// ECMAScript's only on a tie between two same-length candidates, a fractional
/// value from about 2^50 up (`todo/js-number-spelling.md`).
fn js_number(value: f64) -> String {
    if value.is_nan() {
        "NaN".to_string()
    } else if value.is_infinite() {
        (if value > 0.0 { "Infinity" } else { "-Infinity" }).to_string()
    } else if value == 0.0 {
        "0".to_string()
    } else if value.abs() >= 1e21 || value.abs() < 1e-6 {
        let text = format!("{value:e}");
        if text.contains("e-") {
            text
        } else {
            text.replace('e', "e+")
        }
    } else {
        value.to_string()
    }
}

/// `windowRefusal` of `fjs/effects/node/module.f.mjs`: the numbers a positional
/// read refuses, before a byte is read, in the words both runners use.
fn window_refusal(at: f64, size: f64) -> Option<String> {
    if at.fract() != 0.0 || !at.is_finite() {
        Some(format!("Offset {} is not an integer", js_number(at)))
    } else if at < 0.0 {
        Some(format!("Offset {} is negative", js_number(at)))
    } else if at > MAX_OFFSET as f64 {
        Some(format!(
            "Offset {} exceeds maximum allowed offset of {MAX_OFFSET}",
            js_number(at)
        ))
    } else if size.fract() != 0.0 || !size.is_finite() {
        Some(format!("Chunk size {} is not an integer", js_number(size)))
    } else if size < 0.0 {
        Some(format!("Chunk size {} is negative", js_number(size)))
    } else if size > MAX_FILE_SIZE_BYTES as f64 {
        Some(format!(
            "Chunk size {} exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES} bytes",
            js_number(size)
        ))
    } else {
        None
    }
}

/// The bytes at `at`, at most `size` of them; fewer only at the end of the
/// file. A window the Node runner refuses is refused before the file is opened,
/// with no code.
pub fn read_bytes(path: &str, at: f64, size: f64) -> Result<Vec<u8>, IoError> {
    if let Some(message) = window_refusal(at, size) {
        return Err(IoError {
            code: None,
            message,
        });
    }
    let mut file = File::open(path).map_err(|e| failure(&e, "open", path))?;
    // An empty window reads nothing, so it asks nothing of the file either: the
    // open still happens, but a pipe, which cannot seek, answers it as Node does.
    if size == 0.0 {
        return Ok(Vec::new());
    }
    let mut bytes = Vec::new();
    file.seek(SeekFrom::Start(at as u64))
        .and_then(|_| file.take(size as u64).read_to_end(&mut bytes))
        .map_err(|e| failure(&e, "read", path))?;
    Ok(bytes)
}

/// Creates `path` empty and fails if it exists (`O_CREAT|O_EXCL`). The file is
/// synced before it is closed, so an error the filesystem would report only at
/// the close is reported here (`todo/close-errors.md`); it is left in place, as
/// the Node runner leaves it.
pub fn create_exclusive(path: &str) -> Result<(), IoError> {
    let file = exclusive(path).map_err(|e| failure(&e, "open", path))?;
    sync(&file).map_err(|e| failure(&e, "close", path))
}

fn exclusive(path: &str) -> io::Result<File> {
    OpenOptions::new().write(true).create_new(true).open(path)
}

/// Creates `path` holding `data`, in one open that fails if the file exists:
/// the file either exists holding all of `data` or does not exist. A write that
/// fails after the create removes the file, which is this call's alone because
/// the create was exclusive; that is why it is not `write_file`. The data is
/// synced before the file is closed, so an error the filesystem reports only at
/// the close, a delayed `EIO` or `ENOSPC`, fails the write and is rolled back
/// like any other (`todo/close-errors.md`).
pub fn write_exclusive(path: &str, data: &[Vec<u8>]) -> Result<(), IoError> {
    write_exclusive_with(path, |file| {
        data.iter().try_for_each(|d| file.write_all(d))?;
        sync(file)
    })
}

fn write_exclusive_with(
    path: &str,
    write: impl FnOnce(&mut File) -> io::Result<()>,
) -> Result<(), IoError> {
    // The file is closed when the block ends, before the rollback removes it.
    let written = {
        let mut file = exclusive(path).map_err(|e| failure(&e, "open", path))?;
        write(&mut file)
    };
    written.map_err(|e| {
        let _ = fs::remove_file(path);
        failure(&e, "write", path)
    })
}

/// Removes a file or a link, and refuses a directory with `ERR_FS_EISDIR`, the
/// code `rm` without `recursive` gives on Node, where `remove_file` would
/// answer what the platform does. Windows directory symlinks need `remove_dir`;
/// the link's own metadata selects that API, even when its target is missing.
pub fn rm(path: &str) -> Result<(), IoError> {
    let metadata = fs::symlink_metadata(path);
    if metadata.as_ref().is_ok_and(|m| m.is_dir()) {
        return Err(refusal(
            "ERR_FS_EISDIR",
            format!("Path is a directory: rm returned EISDIR (is a directory) {path}"),
        ));
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::FileTypeExt;

        if metadata.is_ok_and(|m| m.file_type().is_symlink_dir()) {
            return fs::remove_dir(path).map_err(|e| failure(&e, "rm", path));
        }
    }
    fs::remove_file(path).map_err(|e| failure(&e, "rm", path))
}

/// What `stat` answers: the size and which of the two kinds a caller acts on
/// the entry is. A link is followed, a FIFO, a device and a socket are neither
/// (`FileStat` in `fjs/effects/node/types.ts`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Stat {
    pub size: u64,
    pub is_file: bool,
    pub is_directory: bool,
}

pub fn stat(path: &str) -> Result<Stat, IoError> {
    let metadata = fs::metadata(path).map_err(|e| failure(&e, "stat", path))?;
    Ok(Stat {
        size: metadata.len(),
        is_file: metadata.is_file(),
        is_directory: metadata.is_dir(),
    })
}

/// Whether the path exists, as `access` with no mode asks: a link is followed.
pub fn access(path: &str) -> Result<(), IoError> {
    fs::metadata(path)
        .map(|_| ())
        .map_err(|e| failure(&e, "access", path))
}

/// Moves `src` to `dst`, replacing a file there.
pub fn rename(src: &str, dst: &str) -> Result<(), IoError> {
    fs::rename(src, dst).map_err(|e| failure(&e, "rename", &format!("{src}' -> '{dst}")))
}

/// Removes an empty directory. Nothing is followed: a link, to a directory or
/// not, is `ENOTDIR`, as is a file, which holds on every host (`Rmdir` in
/// `fjs/effects/node/types.ts`); Windows would otherwise remove a directory
/// link. `FileType::is_symlink` is true for a Windows junction too: std reads
/// it from the reparse tag's name-surrogate bit (`0x20000000`), which the
/// symlink tag `0xA000000C` and the mount-point tag `0xA0000003` both carry.
pub fn rmdir(path: &str) -> Result<(), IoError> {
    if fs::symlink_metadata(path).is_ok_and(|m| m.file_type().is_symlink()) {
        return Err(failure(&ErrorKind::NotADirectory.into(), "rmdir", path));
    }
    fs::remove_dir(path).map_err(|e| failure(&e, "rmdir", path))
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

    #[test]
    fn js_numbers() {
        assert_eq!(js_number(f64::NAN), "NaN");
        assert_eq!(js_number(f64::INFINITY), "Infinity");
        assert_eq!(js_number(f64::NEG_INFINITY), "-Infinity");
        assert_eq!(js_number(-0.0), "0");
        assert_eq!(js_number(1.5), "1.5");
        assert_eq!(js_number(-7.0), "-7");
        assert_eq!(js_number(9007199254740992.0), "9007199254740992");
        assert_eq!(js_number(1e21), "1e+21");
        assert_eq!(js_number(1.5e300), "1.5e+300");
        assert_eq!(js_number(1e-7), "1e-7");
    }

    /// The numbers a positional read refuses, in the words of `windowRefusal`.
    #[test]
    fn window_refusals() {
        let said = |at, size| window_refusal(at, size);
        assert_eq!(said(0.0, 0.0), None);
        assert_eq!(said(9007199254740991.0, 131072.0), None);
        assert_eq!(said(1.5, 1.0), Some("Offset 1.5 is not an integer".into()));
        assert_eq!(
            said(f64::NAN, 1.0),
            Some("Offset NaN is not an integer".into())
        );
        assert_eq!(
            said(f64::INFINITY, 1.0),
            Some("Offset Infinity is not an integer".into())
        );
        assert_eq!(said(-1.0, 1.0), Some("Offset -1 is negative".into()));
        assert_eq!(
            said(9007199254740992.0, 1.0),
            Some(
                "Offset 9007199254740992 exceeds maximum allowed offset of 9007199254740991".into()
            )
        );
        assert_eq!(
            said(0.0, 0.5),
            Some("Chunk size 0.5 is not an integer".into())
        );
        assert_eq!(said(0.0, -2.0), Some("Chunk size -2 is negative".into()));
        assert_eq!(
            said(0.0, 131073.0),
            Some("Chunk size 131073 exceeds maximum allowed size of 131072 bytes".into())
        );
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
        assert_eq!(offset(-0.0), Some(0));
        assert_eq!(offset(MAX_OFFSET as f64 - 1.0), Some(MAX_OFFSET - 1));
        assert_eq!(offset(MAX_OFFSET as f64), Some(MAX_OFFSET));
        assert_eq!(offset(MAX_OFFSET as f64 + 1.0), None);
        assert_eq!(offset(u64::MAX as f64), None);
        assert_eq!(offset(-1.0), None);
        assert_eq!(offset(0.5), None);
        assert_eq!(offset(f64::NAN), None);
        assert_eq!(offset(f64::INFINITY), None);
        assert_eq!(offset(f64::NEG_INFINITY), None);
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
        assert_eq!(code(ErrorKind::ReadOnlyFilesystem), Some("EROFS"));
        assert_eq!(code(ErrorKind::StorageFull), Some("ENOSPC"));
        assert_eq!(code(ErrorKind::Other), None);
    }

    #[test]
    fn failures_preserve_codes_and_context() {
        for (kind, expected) in [
            (ErrorKind::ReadOnlyFilesystem, Some("EROFS")),
            (ErrorKind::StorageFull, Some("ENOSPC")),
            (ErrorKind::Other, None),
        ] {
            let error = failure(&kind.into(), "write", "p");
            assert_eq!(error.code.as_deref(), expected);
            assert!(error.message.ends_with(", write 'p'"));
        }
        let unknown = io::Error::from_raw_os_error(i32::MAX);
        assert_eq!(raw_code(i32::MAX), None);
        assert_eq!(failure(&unknown, "open", "p").code, None);
    }

    #[cfg(any(
        all(
            target_os = "linux",
            any(target_arch = "x86", target_arch = "x86_64", target_arch = "aarch64")
        ),
        target_os = "macos"
    ))]
    #[test]
    fn unix_failures_preserve_raw_codes() {
        for (raw, expected) in [
            (1, "EPERM"),
            (5, "EIO"),
            (23, "ENFILE"),
            (24, "EMFILE"),
            (28, "ENOSPC"),
            (30, "EROFS"),
        ] {
            let error = io::Error::from_raw_os_error(raw);
            assert_eq!(failure(&error, "open", "p").code.as_deref(), Some(expected));
        }
        // A raw permission error must not collapse EPERM into EACCES.
        let denied = io::Error::from_raw_os_error(13);
        assert_eq!(
            failure(&denied, "open", "p").code.as_deref(),
            Some("EACCES")
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_failures_preserve_raw_codes() {
        for (raw, expected) in [
            (4, "EMFILE"),
            (5, "EPERM"),
            (19, "EROFS"),
            (39, "ENOSPC"),
            (112, "ENOSPC"),
            (1117, "EIO"),
            (1314, "EPERM"),
            (1921, "ELOOP"),
        ] {
            let error = io::Error::from_raw_os_error(raw);
            assert_eq!(failure(&error, "open", "p").code.as_deref(), Some(expected));
        }
    }

    fn code_of<T: std::fmt::Debug>(r: Result<T, IoError>) -> Option<String> {
        r.unwrap_err().code
    }

    #[test]
    fn whole_read_answers_windows() {
        let max = MAX_FILE_SIZE_BYTES;
        for (size, expected) in [
            (0, vec![]),
            (1, vec![1]),
            (max, vec![max]),
            (max + 1, vec![max, 1]),
            (2 * max + 5, vec![max, max, 5]),
        ] {
            let windows = read_windows("stream", io::repeat(0xa5).take(size)).unwrap();
            let lengths: Vec<u64> = windows.iter().map(|w| w.len() as u64).collect();
            assert_eq!(lengths, expected, "{size}");
        }
    }

    /// A directory is no regular file, and is refused rather than read.
    #[cfg(not(target_family = "wasm"))]
    #[test]
    fn whole_read_refuses_a_directory() {
        let dir = std::env::temp_dir();
        let path = dir.to_string_lossy();
        let error = read_whole(&path).unwrap_err();
        assert_eq!(error.code.as_deref(), Some("ERR_NOT_A_FILE"));
        assert_eq!(error.message, format!("{path} is not a regular file"));
        let missing = dir.join("nanvm-effects-node-no-such-file");
        assert_eq!(
            code_of(read_whole(&missing.to_string_lossy())),
            Some("ENOENT".into())
        );
    }

    #[test]
    fn bounded_read_accepts_up_to_the_limit() {
        for size in [0, 1, MAX_FILE_SIZE_BYTES - 1, MAX_FILE_SIZE_BYTES] {
            let bytes = read_bounded("stream", io::repeat(0xa5).take(size)).unwrap();
            assert_eq!(bytes.len() as u64, size);
            assert!(bytes.iter().all(|&byte| byte == 0xa5));
        }
    }

    /// A larger source is refused after the first excess byte, not read to its end.
    #[test]
    fn bounded_read_refuses_overflow() {
        let mut reader = io::repeat(0).take(MAX_FILE_SIZE_BYTES + 8);
        let error = read_bounded("stream", &mut reader).unwrap_err();
        assert_eq!(reader.limit(), 7);
        assert_eq!(error.code, None);
        assert_eq!(
            error.message,
            "File exceeds maximum allowed size of 131072 bytes: 'stream'"
        );
    }

    #[test]
    fn bounded_read_reports_io_errors() {
        struct Broken;
        impl Read for Broken {
            fn read(&mut self, _: &mut [u8]) -> io::Result<usize> {
                Err(ErrorKind::PermissionDenied.into())
            }
        }
        let error = read_bounded("unreadable", Broken).unwrap_err();
        assert_eq!(error.code, Some("EACCES".into()));
        assert!(error.message.ends_with(", read 'unreadable'"));
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
        fn stat_and_access() {
            let dir = Scratch::new();
            let file = dir.at("f");
            write_file(&file, &[1, 2, 3]).unwrap();
            assert_eq!(
                stat(&file),
                Ok(Stat {
                    size: 3,
                    is_file: true,
                    is_directory: false
                })
            );
            assert_eq!(
                stat(&dir.at("")),
                Ok(Stat {
                    size: stat(&dir.at("")).unwrap().size,
                    is_file: false,
                    is_directory: true
                })
            );
            assert_eq!(code_of(stat(&dir.at("none"))), Some("ENOENT".into()));
            assert_eq!(access(&file), Ok(()));
            assert_eq!(access(&dir.at("")), Ok(()));
            assert_eq!(code_of(access(&dir.at("none"))), Some("ENOENT".into()));
        }

        #[test]
        fn rename_replaces_a_file() {
            let dir = Scratch::new();
            write_file(&dir.at("a"), &[1]).unwrap();
            write_file(&dir.at("b"), &[2]).unwrap();
            assert_eq!(rename(&dir.at("a"), &dir.at("b")), Ok(()));
            assert_eq!(read_file(&dir.at("b")), Ok([1].to_vec()));
            assert_eq!(code_of(read_file(&dir.at("a"))), Some("ENOENT".into()));
            let error = rename(&dir.at("a"), &dir.at("c")).unwrap_err();
            assert_eq!(error.code, Some("ENOENT".into()));
            assert!(error.message.contains(" -> "), "{}", error.message);
        }

        #[test]
        fn rmdir_removes_an_empty_directory_only() {
            let dir = Scratch::new();
            mkdir(&dir.at("d"), false).unwrap();
            write_file(&dir.at("d/f"), &[]).unwrap();
            assert_eq!(code_of(rmdir(&dir.at("d"))), Some("ENOTEMPTY".into()));
            rm(&dir.at("d/f")).unwrap();
            assert_eq!(rmdir(&dir.at("d")), Ok(()));
            assert_eq!(code_of(rmdir(&dir.at("d"))), Some("ENOENT".into()));
            write_file(&dir.at("f"), &[]).unwrap();
            assert_eq!(code_of(rmdir(&dir.at("f"))), Some("ENOTDIR".into()));
        }

        /// A link to a directory is `ENOTDIR` and is left alone.
        #[cfg(unix)]
        #[test]
        fn rmdir_refuses_a_link() {
            let dir = Scratch::new();
            mkdir(&dir.at("target"), false).unwrap();
            std::os::unix::fs::symlink(dir.at("target"), dir.at("link")).unwrap();
            assert_eq!(code_of(rmdir(&dir.at("link"))), Some("ENOTDIR".into()));
            assert_eq!(access(&dir.at("link")), Ok(()));
            assert_eq!(rmdir(&dir.at("target")), Ok(()));
        }

        #[test]
        fn read_bytes_windows() {
            let dir = Scratch::new();
            let file = dir.at("f");
            write_file(&file, &[1, 2, 3, 4, 5]).unwrap();
            assert_eq!(read_bytes(&file, 1.0, 3.0), Ok([2, 3, 4].to_vec()));
            assert_eq!(read_bytes(&file, 3.0, 10.0), Ok([4, 5].to_vec()));
            assert_eq!(read_bytes(&file, 9.0, 4.0), Ok(Vec::new()));
            assert_eq!(read_bytes(&file, 0.0, 0.0), Ok(Vec::new()));
            assert_eq!(
                code_of(read_bytes(&dir.at("none"), 0.0, 1.0)),
                Some("ENOENT".into())
            );
            // Refused before the path is opened: no code, not ENOENT.
            let error = read_bytes(&dir.at("none"), -1.0, 1.0).unwrap_err();
            assert_eq!(error.code, None);
            assert_eq!(error.message, "Offset -1 is negative");
        }

        /// An empty window opens the path and seeks nowhere, so a pipe answers it.
        #[cfg(target_os = "linux")]
        #[test]
        fn empty_read_does_not_seek_a_pipe() {
            use std::os::fd::AsRawFd;

            let (reader, _writer) = io::pipe().unwrap();
            let path = format!("/proc/self/fd/{}", reader.as_raw_fd());
            for at in [0.0, MAX_OFFSET as f64] {
                assert_eq!(read_bytes(&path, at, 0.0), Ok(Vec::new()));
            }
            // A nonempty window still needs the seek, which this file cannot do.
            assert!(read_bytes(&path, 0.0, 1.0).is_err());
        }

        #[test]
        fn exclusive_creation() {
            let dir = Scratch::new();
            let file = dir.at("f");
            assert_eq!(create_exclusive(&file), Ok(()));
            assert_eq!(read_file(&file), Ok(Vec::new()));
            assert_eq!(code_of(create_exclusive(&file)), Some("EEXIST".into()));
            assert_eq!(code_of(write_exclusive(&file, &[])), Some("EEXIST".into()));
            assert_eq!(read_file(&file), Ok(Vec::new()));
        }

        #[test]
        fn write_exclusive_writes_every_chunk() {
            let dir = Scratch::new();
            let file = dir.at("f");
            assert_eq!(
                write_exclusive(&file, &[[1, 2].to_vec(), Vec::new(), [3].to_vec()]),
                Ok(())
            );
            assert_eq!(read_file(&file), Ok([1, 2, 3].to_vec()));
            assert_eq!(
                code_of(write_exclusive(&dir.at("a/b"), &[])),
                Some("ENOENT".into())
            );
        }

        /// A write that fails after the create leaves no file, and the failure
        /// is the write's, not the cleanup's.
        #[test]
        fn a_failed_exclusive_write_is_rolled_back() {
            let dir = Scratch::new();
            let file = dir.at("f");
            let result = write_exclusive_with(&file, |f| {
                f.write_all(&[1])?;
                Err(ErrorKind::StorageFull.into())
            });
            let error = result.unwrap_err();
            assert_eq!(error.code, Some("ENOSPC".into()));
            assert!(error.message.contains("write"), "{}", error.message);
            assert_eq!(code_of(access(&file)), Some("ENOENT".into()));
        }

        /// A file that cannot be synced has nothing to flush: a write to a pipe
        /// succeeds, where `sync_all` alone would answer `EINVAL`.
        #[cfg(target_os = "linux")]
        #[test]
        fn a_file_that_cannot_be_synced_is_not_a_failure() {
            use std::os::fd::AsRawFd;

            let (_reader, writer) = io::pipe().unwrap();
            let path = format!("/proc/self/fd/{}", writer.as_raw_fd());
            let opened = OpenOptions::new().write(true).open(&path).unwrap();
            assert_eq!(
                opened.sync_all().unwrap_err().kind(),
                ErrorKind::InvalidInput
            );
            assert_eq!(write_file(&path, &[1]), Ok(()));
            assert_eq!(write_bytes(&path, 0.0, &[]), Ok(()));
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

        /// `/dev/zero` reports size zero but never reaches EOF. The metadata
        /// precheck alone cannot keep this read within a `Vec`.
        #[cfg(target_os = "linux")]
        #[test]
        fn read_refuses_bytes_hidden_by_metadata() {
            assert_eq!(fs::metadata("/dev/zero").unwrap().len(), 0);
            let error = read_file("/dev/zero").unwrap_err();
            assert_eq!(error.code, None);
            assert_eq!(
                error.message,
                "File exceeds maximum allowed size of 131072 bytes: '/dev/zero'"
            );
        }

        #[cfg(any(
            all(
                target_os = "linux",
                any(target_arch = "x86", target_arch = "x86_64", target_arch = "aarch64")
            ),
            target_os = "macos"
        ))]
        #[test]
        fn read_reports_a_symlink_loop() {
            let dir = Scratch::new();
            let link = dir.at("loop");
            std::os::unix::fs::symlink("loop", &link).unwrap();
            assert_eq!(code_of(read_file(&link)), Some("ELOOP".into()));
        }

        #[test]
        fn unsafe_offsets_are_refused_before_open() {
            let dir = Scratch::new();
            let missing = dir.at("missing");
            for at in [MAX_OFFSET as f64 + 1.0, u64::MAX as f64] {
                // A valid offset on this path would be ENOENT. No sparse file
                // is created to prove the numeric boundary.
                assert_eq!(
                    code_of(write_bytes(&missing, at, &[1])),
                    Some("ERR_OUT_OF_RANGE".into())
                );
            }
            assert!(!Path::new(&missing).exists());
        }

        #[test]
        fn rm_refuses_a_directory() {
            let dir = Scratch::new();
            assert_eq!(code_of(rm(&dir.at(""))), Some("ERR_FS_EISDIR".into()));
            assert_eq!(code_of(rm(&dir.at("none"))), Some("ENOENT".into()));
        }

        /// Removing directory links must leave both empty and nonempty targets.
        /// On Windows, creating these links requires Developer Mode or privilege.
        #[cfg(any(unix, windows))]
        #[test]
        fn rm_removes_directory_links_not_targets() {
            #[cfg(unix)]
            use std::os::unix::fs::symlink as symlink_dir;
            #[cfg(windows)]
            use std::os::windows::fs::symlink_dir;

            let dir = Scratch::new();
            for name in ["empty", "nonempty"] {
                mkdir(&dir.at(name), false).unwrap();
            }
            let child = dir.at("nonempty/child");
            write_file(&child, &[1, 2, 3]).unwrap();
            for name in ["empty", "nonempty", "missing"] {
                let link = dir.at(&format!("{name}-link"));
                symlink_dir(dir.at(name), &link).unwrap();
                assert!(fs::symlink_metadata(&link).unwrap().is_symlink());
                assert_eq!(rm(&link), Ok(()));
                // exists() follows links, so it cannot prove a dangling link is gone.
                let error = fs::symlink_metadata(&link).unwrap_err();
                assert_eq!(error.kind(), ErrorKind::NotFound);
            }
            for name in ["empty", "nonempty"] {
                let target = dir.at(name);
                assert!(Path::new(&target).is_dir());
                assert_eq!(code_of(rm(&target)), Some("ERR_FS_EISDIR".into()));
                assert!(Path::new(&target).is_dir());
            }
            assert_eq!(read_file(&child), Ok([1, 2, 3].to_vec()));
            assert!(!Path::new(&dir.at("missing")).exists());
        }

        /// File links, including dangling ones, still use the file-removal path.
        #[cfg(any(unix, windows))]
        #[test]
        fn rm_removes_file_links_not_targets() {
            #[cfg(unix)]
            use std::os::unix::fs::symlink as symlink_file;
            #[cfg(windows)]
            use std::os::windows::fs::symlink_file;

            let dir = Scratch::new();
            let target = dir.at("file");
            write_file(&target, &[4, 5]).unwrap();
            for name in ["file", "missing"] {
                let link = dir.at(&format!("{name}-link"));
                symlink_file(dir.at(name), &link).unwrap();
                assert!(fs::symlink_metadata(&link).unwrap().is_symlink());
                assert_eq!(rm(&link), Ok(()));
                let error = fs::symlink_metadata(&link).unwrap_err();
                assert_eq!(error.kind(), ErrorKind::NotFound);
            }
            assert_eq!(read_file(&target), Ok([4, 5].to_vec()));
            assert!(!Path::new(&dir.at("missing")).exists());
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

        #[test]
        fn empty_write_preserves_open_and_offset_checks() {
            let dir = Scratch::new();
            let file = dir.at("a");
            assert_eq!(code_of(write_bytes(&file, 0.0, &[])), Some("ENOENT".into()));
            assert!(!Path::new(&file).exists());
            write_file(&file, &[1, 2, 3]).unwrap();
            for at in [0.0, 1.0, MAX_OFFSET as f64] {
                assert_eq!(write_bytes(&file, at, &[]), Ok(()));
                assert_eq!(read_file(&file), Ok([1, 2, 3].to_vec()));
            }
            for at in [-1.0, 0.5, f64::NAN, f64::INFINITY, MAX_OFFSET as f64 + 1.0] {
                assert_eq!(
                    code_of(write_bytes(&file, at, &[])),
                    Some("ERR_OUT_OF_RANGE".into())
                );
            }
        }

        /// Reopen an anonymous pipe through procfs without a FIFO utility or FFI.
        /// A nonempty positional write still fails: this file is not seekable.
        #[cfg(target_os = "linux")]
        #[test]
        fn empty_write_does_not_seek_a_pipe() {
            use std::os::fd::AsRawFd;

            let (_reader, writer) = io::pipe().unwrap();
            let path = format!("/proc/self/fd/{}", writer.as_raw_fd());
            for at in [0.0, MAX_OFFSET as f64] {
                assert_eq!(write_bytes(&path, at, &[]), Ok(()));
            }
            assert!(write_bytes(&path, 0.0, &[1]).is_err());
        }

        /// Match the promise API the Node runner uses. Callback and sync
        /// readdir follow directory links; fs.promises.readdir with withFileTypes
        /// does not. Links to files and missing targets keep both flags false too.
        #[cfg(unix)]
        #[test]
        fn readdir_lists_symlinks_without_following_them() {
            use std::os::unix::fs::symlink;

            let dir = Scratch::new();
            mkdir(&dir.at("root"), false).unwrap();
            mkdir(&dir.at("target"), false).unwrap();
            write_file(&dir.at("target/child"), &[]).unwrap();
            for (name, target) in [
                ("dir-link", "../target"),
                ("file-link", "../target/child"),
                ("missing-link", "../missing"),
            ] {
                symlink(target, dir.at(&format!("root/{name}"))).unwrap();
            }
            let root = dir.at("root");
            let expected = ["dir-link", "file-link", "missing-link"].map(|name| Dirent {
                name: name.into(),
                parent_path: normalize(&root),
                is_file: false,
                is_directory: false,
            });
            for recursive in [false, true] {
                assert_eq!(readdir(&root, recursive).unwrap(), expected);
            }
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
