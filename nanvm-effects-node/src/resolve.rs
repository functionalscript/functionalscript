//! Resolving a module to the file that holds it, as `resolveFileModule` of
//! `fjs/effects/node/module.mjs` does: a path, or a specifier relative to the
//! file that imports it, becomes the real path of the file and its identity, a
//! `file:` URL.
//!
//! The specifier rules are `fjs/path/import`'s: no scheme, backslash, query or
//! fragment; dot segments cancel before anything is decoded; what survives is
//! percent-decoded, strictly, into names that hold no separator and no colon.
//! The identity is `pathToFileURL` of the real path, whose percent-encoding is
//! the set Node 22 encodes: the controls, space, `"`, `#`, `%`, `<`, `>`, `?`,
//! `[`, `\`, `]`, `^`, `` ` ``, `{`, `|`, `}`, `~`, and every byte that is not
//! ASCII. Native paths must be Unicode; imports requiring raw-character URL
//! preprocessing are refused. See `../todo/module-path-encoding.md`.

use crate::files::IoError;
use std::{
    fs,
    path::{Component, Path, PathBuf},
};

/// The module a specifier names: the real path of its file and its identity,
/// a `file:` URL.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileModule {
    pub id: String,
    pub path: String,
}

/// A refusal that is not the file system's: a specifier or URL Node rejects,
/// with the code it gives where it gives one.
fn refusal(code: Option<&str>, message: &str) -> IoError {
    IoError {
        code: code.map(str::to_string),
        message: message.to_string(),
    }
}

/// `%XX` escapes read as the bytes they are, and the bytes as UTF-8; `None`
/// where an escape is cut short or not hexadecimal, or the bytes are not UTF-8.
pub fn percent_decode(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let pair = text.get(i + 1..i + 3)?;
            decoded.push(u8::from_str_radix(pair, 16).ok()?);
            i += 3;
        } else {
            decoded.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

/// A path as the text of a URL's path: the bytes `pathToFileURL` escapes, as `%XX`.
pub fn percent_encode(path: &str) -> String {
    let mut encoded = String::with_capacity(path.len());
    for &b in path.as_bytes() {
        match b {
            0..=0x20
            | 0x7f..
            | b'"'
            | b'#'
            | b'%'
            | b'<'
            | b'>'
            | b'?'
            | b'['
            | b'\\'
            | b']'
            | b'^'
            | b'`'
            | b'{'
            | b'|'
            | b'}'
            | b'~' => encoded.push_str(&format!("%{b:02X}")),
            _ => encoded.push(char::from(b)),
        }
    }
    encoded
}

/// The kind of one URL path segment, read while it is still encoded: only the
/// exact dot spellings are structural.
enum Kind {
    Skip,
    Up,
    Keep,
}

fn kind(segment: &str) -> Kind {
    match segment.to_ascii_lowercase().as_str() {
        "." | "%2e" => Kind::Skip,
        ".." | ".%2e" | "%2e." | "%2e%2e" => Kind::Up,
        _ => Kind::Keep,
    }
}

/// One surviving segment as a file name, or `None`: decoded, it may hold no
/// separator, no NUL and no colon.
fn segment(raw: &str) -> Option<String> {
    let decoded = percent_decode(raw)?;
    (!decoded.contains(['/', '\\', '\0', ':'])).then_some(decoded)
}

/// `decode` of `fjs/path/import`: an import specifier as whether it is rooted
/// and the portable names that follow, joined by `/`, or `None` for one that
/// names no file. A `..` that has nothing to cancel stays in a relative
/// specifier and goes in a rooted one. Keeping the root apart from the names
/// is where this differs: `.//x` is relative here, as a URL reads it, where
/// the JavaScript text of `.//x` is `/x`, a root.
pub fn decode_specifier(specifier: &str) -> Option<(bool, String)> {
    if specifier.contains([':', '\\', '?', '#']) {
        return None;
    }
    let rooted = specifier.starts_with('/');
    let mut kept: Vec<&str> = Vec::new();
    for raw in specifier.split('/').skip(usize::from(rooted)) {
        match kind(raw) {
            Kind::Skip => {}
            Kind::Up => match kept.last() {
                None if rooted => {}
                Some(&last) if last != ".." => {
                    kept.pop();
                }
                _ => kept.push(".."),
            },
            Kind::Keep => kept.push(raw),
        }
    }
    let names: Option<Vec<String>> = kept.into_iter().map(segment).collect();
    names.map(|names| (rooted, names.join("/")))
}

/// `fileURLToPath`, for a URL this runner made or one like it: the path, where
/// the URL names one on this machine.
pub fn file_url_to_path(url: &str) -> Result<String, IoError> {
    let Some(rest) = url.strip_prefix("file://") else {
        return Err(refusal(None, "only file modules are supported"));
    };
    if !rest.starts_with('/') {
        return Err(refusal(
            Some("ERR_INVALID_FILE_URL_HOST"),
            "File URL host must be \"localhost\" or empty",
        ));
    }
    let invalid = || {
        refusal(
            Some("ERR_INVALID_FILE_URL_PATH"),
            "File URL path must not include encoded / characters",
        )
    };
    if rest.to_ascii_lowercase().contains("%2f") {
        return Err(invalid());
    }
    let path = percent_decode(rest).ok_or_else(invalid)?;
    // Only Windows reads `/C:/a` as the drive path `C:/a`. On POSIX the
    // leading slash and the colon are part of the native absolute path.
    let drive = path.as_bytes();
    Ok(
        if cfg!(windows) && drive.len() >= 3 && drive[2] == b':' && drive[1].is_ascii_alphabetic() {
            path[1..].to_string()
        } else {
            path
        },
    )
}

/// `pathToFileURL` of an absolute path.
pub fn path_to_file_url(path: &str) -> String {
    let path = if cfg!(windows) {
        path.replace('\\', "/")
    } else {
        path.to_string()
    };
    let rooted = if path.starts_with('/') {
        path
    } else {
        format!("/{path}")
    };
    format!("file://{}", percent_encode(&rooted))
}

/// Keep native drive paths, stripping only their extended-length prefix.
/// UNC and device paths need URL-authority support that this resolver lacks:
/// refuse them rather than returning a plausible but incorrect module identity.
/// See `nanvm-effects-node/todo/unc-module-identities.md`.
/// This lexical helper is tested on every platform, without accessing a share.
fn windows_path(path: &str) -> std::io::Result<&str> {
    if let Some(plain) = path.strip_prefix(r"\\?\") {
        let bytes = plain.as_bytes();
        if bytes.len() >= 3
            && bytes[0].is_ascii_alphabetic()
            && bytes[1] == b':'
            && bytes[2] == b'\\'
        {
            return Ok(plain);
        }
    } else if !path.starts_with(r"\\") && !path.starts_with("//") {
        return Ok(path);
    }
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "UNC and device module paths are not supported",
    ))
}

/// Module identities must not replace native filename bytes with U+FFFD.
/// Apply the same lossless conversion to cwd-derived and canonical paths.
fn path_text(path: &Path) -> std::io::Result<String> {
    path.to_str().map(str::to_string).ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "non-UTF-8 module paths are not supported",
        )
    })
}

/// Resolve native roots before reducing dot segments, without following links.
/// `absolute` handles Windows root-relative and drive-relative paths; native
/// components keep POSIX backslashes and colons literal. Like `pathToFileURL`,
/// collapse `..` before realpath, but keep an explicit trailing separator.
fn absolute_path(path: &str) -> std::io::Result<String> {
    let path = if cfg!(windows) {
        windows_path(path)?
    } else {
        path
    };
    let absolute = std::path::absolute(if path.is_empty() { "." } else { path })?;
    let mut normalized = PathBuf::new();
    for component in absolute.components() {
        match component {
            Component::ParentDir => {
                normalized.pop();
            }
            Component::CurDir => {}
            other => normalized.push(other.as_os_str()),
        }
    }
    let mut result = path_text(&normalized)?;
    if path.ends_with(std::path::is_separator) && !result.ends_with(std::path::is_separator) {
        result.push(std::path::MAIN_SEPARATOR);
    }
    // `absolute` may have supplied a UNC working directory, even for a local
    // relative input. Never turn it into a URL without authority support.
    if cfg!(windows) {
        windows_path(&result).map(str::to_string)
    } else {
        Ok(result)
    }
}

/// A URL ending in a slash or a dot segment still names a directory after
/// dot-segment reduction. An empty specifier instead names the importer itself.
fn directory_specifier(name: &str) -> bool {
    name.ends_with('/') || !matches!(kind(name.rsplit('/').next().unwrap_or("")), Kind::Keep)
}

/// Raw `C|` components can become URL drive markers, even after dot reduction.
/// Refuse them conservatively until URL-aware drive handling is implemented.
/// Inspect raw components: `%43|` and `C%7C` are literal names, not markers.
/// See `nanvm-effects-node/todo/local-file-url-authorities.md`.
fn has_legacy_drive_marker(name: &str) -> bool {
    name.split('/')
        .any(|part| matches!(part.as_bytes(), [letter, b'|'] if letter.is_ascii_alphabetic()))
}

/// Refuse raw imports that WHATWG preprocessing would change. Percent escapes
/// and literal entry paths are not preprocessed; internal spaces stay literal.
/// See `../todo/module-path-encoding.md` for the deferred URL behavior.
fn needs_url_preprocessing(name: &str) -> bool {
    name.trim_matches(|c: char| c <= ' ') != name || name.contains(['\t', '\n', '\r'])
}

/// The real native path, without a Windows drive's extended-length prefix.
/// Check again after canonicalization: a local link may resolve to a UNC path.
fn real_path(path: &str) -> std::io::Result<String> {
    // Some hosts canonicalize a regular file even with a trailing separator.
    // Enforce the directory requirement before canonicalization can erase it.
    if path.ends_with(std::path::is_separator) && !fs::metadata(path)?.is_dir() {
        return Err(std::io::ErrorKind::NotADirectory.into());
    }
    let real = path_text(&fs::canonicalize(path)?)?;
    if cfg!(windows) {
        windows_path(&real).map(str::to_string)
    } else {
        Ok(real)
    }
}

/// The slash-separated directory of a decoded file URL path.
fn directory(path: &str) -> &str {
    path.rfind('/').map_or("", |i| &path[..i])
}

/// The module `name` names, from the file `parent`'s identity, or from the
/// working directory where there is none: the real path and its identity.
pub fn resolve_file_module(name: &str, parent: Option<&str>) -> Result<FileModule, IoError> {
    let loading = match parent {
        None => name.to_string(),
        Some(parent) => {
            let invalid = || refusal(None, "invalid module specifier");
            // An authority is not a path segment: `//host/../../x` must not
            // lose its host during dot reduction and turn into a local import.
            // Empty and localhost authorities remain unsupported too; see
            // `nanvm-effects-node/todo/local-file-url-authorities.md`.
            // Raw drive markers must not be erased by dot reduction either,
            // or confused with percent-encoded literal names.
            if needs_url_preprocessing(name)
                || name.starts_with("//")
                || has_legacy_drive_marker(name)
            {
                return Err(invalid());
            }
            let (rooted, names) = decode_specifier(name).ok_or_else(invalid)?;
            let importer = file_url_to_path(parent)?;
            let mut path = if rooted {
                // On Windows a rooted import keeps the importer's drive,
                // which need not be the current working directory's drive.
                path_text(&Path::new(&importer).join(format!("/{names}")))
                    .map_err(|e| crate::files::failure(&e, "resolveFileModule", name))?
            } else if name.is_empty() {
                importer
            } else {
                format!("{}/{names}", directory(&importer))
            };
            if directory_specifier(name) && !path.ends_with('/') {
                path.push('/');
            }
            path
        }
    };
    let loading = absolute_path(&loading)
        .map_err(|e| crate::files::failure(&e, "resolveFileModule", &loading))?;
    let path = real_path(&loading).map_err(|e| crate::files::failure(&e, "realpath", &loading))?;
    Ok(FileModule {
        id: path_to_file_url(&path),
        path,
    })
}

#[cfg(test)]
mod test {
    use super::*;

    /// What `decode` of `fjs/path/import` answers, by node, as (rooted, names);
    /// `None` is its `null`.
    #[test]
    fn specifiers() {
        let rel = |s: &str| Some((false, s.to_string()));
        let root = |s: &str| Some((true, s.to_string()));
        for (specifier, expected) in [
            ("./a", rel("a")),
            ("../a", rel("../a")),
            ("a", rel("a")),
            ("a/b", rel("a/b")),
            ("/a", root("a")),
            ("/", root("")),
            ("", rel("")),
            (".", rel("")),
            ("..", rel("..")),
            ("./a/./b", rel("a/b")),
            ("a/../b", rel("b")),
            ("a/../../b", rel("../b")),
            ("/a/../../b", root("b")),
            ("a%20b", rel("a b")),
            ("%2e%2e/a", rel("../a")),
            ("./%2E/a", rel("a")),
            (".%2e/x", rel("../x")),
            ("a//b", rel("a//b")),
            ("a/", rel("a/")),
            ("a%2Fb", None),
            ("a%5Cb", None),
            ("a%3Ab", None),
            ("a%00b", None),
            ("a:b", None),
            ("a\\b", None),
            ("a?b", None),
            ("a#b", None),
            ("a%3Fb", rel("a?b")),
            ("a%23b", rel("a#b")),
            ("%zz", None),
            ("%e0%a4", None),
            ("é", rel("é")),
            ("a%C3%A9", rel("aé")),
            ("%2e", rel("")),
            ("bad%/../dep", rel("dep")),
            ("../../x", rel("../../x")),
            ("./../x/../..", rel("../..")),
            (".//x", rel("/x")),
        ] {
            assert_eq!(decode_specifier(specifier), expected, "{specifier:?}");
        }
    }

    #[test]
    fn directory_specifiers_keep_their_meaning() {
        for name in [
            "a/", "a//", "a/.", "a/%2e", "a/b/..", "a/b/.%2E", ".", "..", "/",
        ] {
            assert!(directory_specifier(name), "{name:?}");
        }
        for name in ["", "a", "./a", "...", "a%252e", "a%2e", "a%2Fb"] {
            assert!(!directory_specifier(name), "{name:?}");
        }
    }

    /// Root-relative entries must not be prefixed with the whole cwd. No
    /// second drive, share, symlink privilege or cwd mutation is required.
    #[cfg(windows)]
    #[test]
    fn windows_root_relative_entries_use_the_current_drive() {
        let module = resolve_file_module("Cargo.toml", None).unwrap();
        let rooted = &module.path[2..];
        for name in [rooted.to_string(), rooted.replace('\\', "/")] {
            assert_eq!(resolve_file_module(&name, None).unwrap(), module);
        }
        let drive_relative = format!("{}Cargo.toml", &module.path[..2]);
        assert_eq!(resolve_file_module(&drive_relative, None).unwrap(), module);
    }

    #[test]
    fn percent_coding() {
        assert_eq!(percent_decode("a%20b%C3%A9"), Some("a bé".to_string()));
        assert_eq!(percent_decode("%2"), None);
        assert_eq!(percent_decode("%g0"), None);
        assert_eq!(percent_decode("%ff"), None);
        // Node 22: the characters `pathToFileURL` escapes, one of each kind.
        assert_eq!(
            percent_encode("/a b\\\"#%<>?[]^`{|}~\u{7f}\u{1}é😀x"),
            "/a%20b%5C%22%23%25%3C%3E%3F%5B%5D%5E%60%7B%7C%7D%7E%7F%01%C3%A9%F0%9F%98%80x"
        );
        assert_eq!(
            percent_encode("/a-b_c.d/e!f$g&h'i(j)k*l+m,n;o=p@q"),
            "/a-b_c.d/e!f$g&h'i(j)k*l+m,n;o=p@q"
        );
    }

    #[test]
    fn windows_drive_paths_keep_their_native_spelling() {
        for (path, expected) in [
            (r"C:\work\a b.f.js", r"C:\work\a b.f.js"),
            (r"\\?\C:\work\a b.f.js", r"C:\work\a b.f.js"),
            (r"\\?\d:\src\m.f.js", r"d:\src\m.f.js"),
        ] {
            assert_eq!(windows_path(path).unwrap(), expected);
        }
    }

    #[test]
    fn unsupported_windows_paths_do_not_become_module_ids() {
        for path in [
            r"\\server\share\src\m.f.js",
            "//server/share/src/m.f.js",
            r"\\?\UNC\server\share\src\m.f.js",
            r"\\?\Volume{example}\src\m.f.js",
            r"\\.\pipe\module",
        ] {
            let error = windows_path(path).unwrap_err();
            assert_eq!(error.kind(), std::io::ErrorKind::Unsupported);
            assert_eq!(
                error.to_string(),
                "UNC and device module paths are not supported"
            );
        }
    }

    /// No share or symlink privilege is needed: refusal precedes filesystem IO.
    #[cfg(windows)]
    #[test]
    fn unc_module_inputs_are_refused_before_filesystem_io() {
        for path in [
            r"\\server\share\m.f.js",
            "//server/share/m.f.js",
            r"\\?\UNC\server\share\m.f.js",
        ] {
            let error = resolve_file_module(path, None).unwrap_err();
            assert_eq!(error.code, None);
            assert!(
                error
                    .message
                    .contains("UNC and device module paths are not supported")
            );
        }
    }

    #[test]
    fn file_urls() {
        assert_eq!(path_to_file_url("/a/b c"), "file:///a/b%20c");
        if cfg!(windows) {
            assert_eq!(path_to_file_url(r"C:\a\b"), "file:///C:/a/b");
        } else {
            assert_eq!(path_to_file_url(r"/a\b/m.f.js"), "file:///a%5Cb/m.f.js");
            assert_eq!(
                file_url_to_path("file:///a%5Cb/m.f.js"),
                Ok(r"/a\b/m.f.js".to_string())
            );
        }
        assert_eq!(
            file_url_to_path("file:///a/b%20c"),
            Ok("/a/b c".to_string())
        );
        assert_eq!(
            file_url_to_path("file:///C:/a"),
            Ok(if cfg!(windows) { "C:/a" } else { "/C:/a" }.to_string())
        );
        assert_eq!(file_url_to_path("file:///%C3%A9"), Ok("/é".to_string()));
        let code = |r: Result<String, IoError>| match r {
            Err(info) => (info.code, info.message),
            other => panic!("{other:?}"),
        };
        assert_eq!(code(file_url_to_path("http://a/b")).0, None);
        assert_eq!(
            code(file_url_to_path("file://host/a")).0,
            Some("ERR_INVALID_FILE_URL_HOST".into())
        );
        assert_eq!(
            code(file_url_to_path("file:///a%2Fb")).0,
            Some("ERR_INVALID_FILE_URL_PATH".into())
        );
        assert_eq!(
            code(file_url_to_path("file:///a%ff")).0,
            Some("ERR_INVALID_FILE_URL_PATH".into())
        );
    }

    #[test]
    fn refused_specifiers() {
        let message = |name: &str| match resolve_file_module(name, Some("file:///a/b.f.js")) {
            Err(info) => info.message,
            other => panic!("{other:?}"),
        };
        assert_eq!(message("x:y"), "invalid module specifier");
        assert_eq!(message("a%2Fb"), "invalid module specifier");
        assert_eq!(message("//x/y"), "invalid module specifier");
        assert_eq!(message("./a?b"), "invalid module specifier");
    }

    /// Refuse unsupported authorities before decoding can erase the host.
    /// These checks need neither a local fixture nor a network share.
    #[test]
    fn authorities_are_refused_before_dot_reduction() {
        for parent in ["file:///missing/main.f.js", "file:///C:/missing/main.f.js"] {
            for name in [
                "//",
                "///tmp/dep.f.js",
                "////tmp/dep.f.js",
                "//localhost/tmp/dep.f.js",
                "//LOCALHOST/tmp/dep.f.js",
                "//%6cocalhost/tmp/dep.f.js",
                "//host/../../Cargo.toml",
                "//host/%2e%2e/%2e%2e/Cargo.toml",
                "//localhost/../../Cargo.toml",
                "///../../Cargo.toml",
            ] {
                let error = resolve_file_module(name, Some(parent)).unwrap_err();
                assert_eq!(error.code, None, "{name:?}");
                assert_eq!(error.message, "invalid module specifier", "{name:?}");
            }
        }
    }

    /// Refusal happens before URL decoding or filesystem access on every host.
    #[test]
    fn legacy_drive_markers_are_refused_before_dot_reduction() {
        for parent in ["file:///missing/main.f.js", "file:///D:/missing/main.f.js"] {
            for name in [
                "/C|/dep.f.js",
                "/z|/dep.f.js",
                "C|/dep.f.js",
                "C|",
                "/C|",
                "/C|/../dep.f.js",
                "/C|/%2e%2e/dep.f.js",
                "C|/../../dep.f.js",
                "/./C|/dep.f.js",
                "/%2e/C|/dep.f.js",
                "/gone/../C|/dep.f.js",
                "/gone/%2e%2e/C|/../dep.f.js",
                "../C|/dep.f.js",
                "./C|/dep.f.js",
            ] {
                assert!(decode_specifier(name).is_some(), "{name:?}");
                let error = resolve_file_module(name, Some(parent)).unwrap_err();
                assert_eq!(error.code, None, "{name:?}");
                assert_eq!(error.message, "invalid module specifier", "{name:?}");
            }
        }
    }

    #[test]
    fn encoded_and_non_drive_names_are_not_raw_drive_markers() {
        for name in [
            "",
            "/",
            "/CC|/dep.f.js",
            "/1|/dep.f.js",
            "/é|/dep.f.js",
            "/a|b/dep.f.js",
            "/%43|/dep.f.js",
            "/C%7C/dep.f.js",
            "/%43%7c/dep.f.js",
            "/%2543|/dep.f.js",
        ] {
            assert!(!has_legacy_drive_marker(name), "{name:?}");
        }
        // Decoding first would erase the distinction the URL parser observes.
        assert_eq!(
            decode_specifier("/C|/dep.f.js"),
            decode_specifier("/%43|/dep.f.js")
        );
    }

    #[test]
    fn raw_url_preprocessing_is_refused_before_resolution() {
        let refused = |name: &str| {
            assert!(needs_url_preprocessing(name), "{name:?}");
            for parent in ["file:///missing/main.f.js", "file:///C:/missing/main.f.js"] {
                let error = resolve_file_module(name, Some(parent)).unwrap_err();
                assert_eq!(error.code, None, "{name:?}");
                assert_eq!(error.message, "invalid module specifier", "{name:?}");
            }
        };
        for byte in 0..=b' ' {
            let c = char::from(byte);
            refused(&format!("{c}./dep"));
            refused(&format!("./dep{c}"));
        }
        for name in ["./a\tb", "./a\nb", "./a\rb", " /C|/dep", "/\t/host/x"] {
            refused(name);
        }
    }

    #[test]
    fn encoded_and_internal_filename_characters_are_not_preprocessed() {
        for name in [
            "",
            "./dep%20",
            "./a%09b",
            "./a%0Ab",
            "./a%0Db",
            "./dep%01",
            "./a b",
            "./a\u{1}b",
            "./dep\u{a0}",
            "\u{feff}dep",
        ] {
            assert!(!needs_url_preprocessing(name), "{name:?}");
            assert!(decode_specifier(name).is_some(), "{name:?}");
        }
    }

    #[cfg(unix)]
    #[test]
    fn non_utf8_path_text_is_not_replaced() {
        use std::{ffi::OsStr, os::unix::ffi::OsStrExt};
        let path = Path::new(OsStr::from_bytes(b"bad-\xff"));
        assert_eq!(
            path_text(path).unwrap_err().kind(),
            std::io::ErrorKind::InvalidData
        );
        assert_eq!(path_text(Path::new("\u{fffd}")).unwrap(), "\u{fffd}");
    }

    #[cfg(windows)]
    #[test]
    fn unpaired_utf16_paths_are_not_replaced() {
        use std::{ffi::OsString, os::windows::ffi::OsStringExt};
        let path = PathBuf::from(OsString::from_wide(&[0xd800]));
        assert_eq!(
            path_text(&path).unwrap_err().kind(),
            std::io::ErrorKind::InvalidData
        );
        assert_eq!(path_text(Path::new("\u{fffd}")).unwrap(), "\u{fffd}");
    }

    /// Against a real tree, with symbolic links: a module is the real file.
    #[cfg(unix)]
    mod files {
        use super::*;
        use std::os::unix::fs::symlink;

        struct Scratch(std::path::PathBuf);

        impl Scratch {
            fn new(name: &str) -> Self {
                let base = std::env::temp_dir().join(format!(
                    "nanvm-effects-node-resolve-{name}-{}",
                    std::process::id()
                ));
                let _ = fs::remove_dir_all(&base);
                fs::create_dir_all(&base).unwrap();
                // The system's temporary directory may itself be a link.
                Self(fs::canonicalize(base).unwrap())
            }
            fn path(&self, name: &str) -> String {
                format!("{}/{name}", self.0.to_string_lossy())
            }
        }

        impl Drop for Scratch {
            fn drop(&mut self) {
                let _ = fs::remove_dir_all(&self.0);
            }
        }

        #[test]
        fn from_a_path_and_from_a_parent() {
            let dir = Scratch::new("tree");
            fs::create_dir_all(dir.path("src/lib")).unwrap();
            fs::write(dir.path("src/main.f.js"), "").unwrap();
            fs::write(dir.path("src/lib/a b.f.js"), "").unwrap();
            fs::write(dir.path("top.f.js"), "").unwrap();
            let main = resolve_file_module(&dir.path("src/./lib/../main.f.js"), None).unwrap();
            assert_eq!(main.path, dir.path("src/main.f.js"));
            assert_eq!(main.id, path_to_file_url(&main.path));
            let ids = |name: &str| resolve_file_module(name, Some(&main.id)).unwrap();
            assert_eq!(ids("./lib/a%20b.f.js").path, dir.path("src/lib/a b.f.js"));
            assert_eq!(
                ids("./lib/a%20b.f.js").id,
                format!("file://{}", percent_encode(&dir.path("src/lib/a b.f.js")))
            );
            assert_eq!(ids("../top.f.js").path, dir.path("top.f.js"));
            assert_eq!(ids("./lib/../../top.f.js").path, dir.path("top.f.js"));
            assert_eq!(ids(".//lib/a%20b.f.js").path, dir.path("src/lib/a b.f.js"));
            assert_eq!(ids(&dir.path("top.f.js")[..]).path, dir.path("top.f.js"));
            assert_eq!(ids("").path, main.path);
            assert_eq!(ids("%2e/main.f.js").path, main.path);
        }

        #[test]
        fn trailing_separators_do_not_turn_files_into_directories() {
            let dir = Scratch::new("trailing");
            fs::write(dir.path("dep.f.js"), "").unwrap();
            fs::create_dir(dir.path("folder")).unwrap();
            let parent = path_to_file_url(&dir.path("main.f.js"));
            for name in [
                "./dep.f.js/",
                "./dep.f.js//",
                "./dep.f.js/.",
                "./dep.f.js/%2e",
                "./dep.f.js/child/..",
            ] {
                for specifier in [name.to_string(), dir.path(name)] {
                    let error = resolve_file_module(&specifier, Some(&parent)).unwrap_err();
                    assert_eq!(error.code.as_deref(), Some("ENOTDIR"), "{specifier:?}");
                }
            }
            let error = resolve_file_module(&dir.path("dep.f.js/"), None).unwrap_err();
            assert_eq!(error.code.as_deref(), Some("ENOTDIR"));
            let folder = resolve_file_module(&dir.path("folder"), None).unwrap();
            assert_eq!(
                resolve_file_module("./folder/", Some(&parent)).unwrap(),
                folder
            );
            assert_eq!(
                resolve_file_module("./folder/.", Some(&parent)).unwrap(),
                folder
            );
            // The directory check follows a link, but keeps missing-path errors.
            symlink(dir.path("folder"), dir.path("folder-link")).unwrap();
            assert_eq!(
                resolve_file_module("./folder-link/", Some(&parent)).unwrap(),
                folder
            );
            let missing = resolve_file_module("./missing/", Some(&parent)).unwrap_err();
            assert_eq!(missing.code.as_deref(), Some("ENOENT"));
            let root = resolve_file_module(&dir.path(""), None).unwrap();
            assert_eq!(resolve_file_module(".", Some(&parent)).unwrap(), root);
            assert_eq!(
                resolve_file_module("./folder/..", Some(&parent)).unwrap(),
                root
            );
        }

        #[test]
        fn posix_backslashes_do_not_alias_path_separators() {
            let dir = Scratch::new("backslash");
            for tree in [r"a\b", "a/b"] {
                fs::create_dir_all(dir.path(tree)).unwrap();
                fs::write(dir.path(&format!("{tree}/main.f.js")), "").unwrap();
                fs::write(dir.path(&format!("{tree}/dep.f.js")), "").unwrap();
            }
            let literal = resolve_file_module(&dir.path(r"a\b/main.f.js"), None).unwrap();
            let separated = resolve_file_module(&dir.path("a/b/main.f.js"), None).unwrap();
            assert_eq!(literal.path, dir.path(r"a\b/main.f.js"));
            assert_ne!(literal.id, separated.id);
            assert!(literal.id.ends_with("/a%5Cb/main.f.js"));
            assert_eq!(file_url_to_path(&literal.id).unwrap(), literal.path);
            let dep = resolve_file_module("./dep.f.js", Some(&literal.id)).unwrap();
            assert_eq!(dep.path, dir.path(r"a\b/dep.f.js"));
            assert_eq!(
                resolve_file_module("./main.f.js", Some(&dep.id)).unwrap(),
                literal
            );
        }

        #[test]
        fn escaped_drive_bar_names_remain_literal() {
            let dir = Scratch::new("drive-bar");
            fs::create_dir(dir.path("C|")).unwrap();
            fs::write(dir.path("C|/dep.f.js"), "").unwrap();
            // An entry is a literal path, not an import specifier.
            let literal = resolve_file_module(&dir.path("C|/dep.f.js"), None).unwrap();
            assert!(literal.id.ends_with("/C%7C/dep.f.js"));
            let parent = path_to_file_url(&dir.path("main.f.js"));
            for name in ["./%43|/dep.f.js", "./C%7C/dep.f.js", "./%43%7c/dep.f.js"] {
                assert_eq!(resolve_file_module(name, Some(&parent)).unwrap(), literal);
            }
            assert_eq!(
                resolve_file_module("./dep.f.js", Some(&literal.id)).unwrap(),
                literal
            );
            let error = resolve_file_module("./C|/dep.f.js", Some(&parent)).unwrap_err();
            assert_eq!(error.message, "invalid module specifier");
        }

        #[test]
        fn entry_dot_segments_are_reduced_before_following_symlinks() {
            let dir = Scratch::new("lexical");
            fs::create_dir_all(dir.path("target/nested")).unwrap();
            fs::write(dir.path("main.f.js"), "").unwrap();
            fs::write(dir.path("target/main.f.js"), "").unwrap();
            symlink(dir.path("target/nested"), dir.path("link")).unwrap();
            let module = resolve_file_module(&dir.path("link/../main.f.js"), None).unwrap();
            assert_eq!(module.path, dir.path("main.f.js"));
        }

        // APFS rejects non-UTF-8 names at creation; use Linux for the real
        // collision fixture. The lossless conversion is tested on every OS.
        #[cfg(target_os = "linux")]
        #[test]
        fn non_utf8_targets_do_not_alias_replacement_characters() {
            use std::{ffi::OsStr, os::unix::ffi::OsStrExt};
            let dir = Scratch::new("non-utf8");
            let raw = dir.0.join(OsStr::from_bytes(b"bad-\xff"));
            fs::create_dir(&raw).unwrap();
            fs::write(raw.join("dep.f.js"), "original").unwrap();
            fs::create_dir(dir.path("bad-\u{fffd}")).unwrap();
            let replacement = dir.path("bad-\u{fffd}/dep.f.js");
            fs::write(&replacement, "replacement").unwrap();
            symlink(raw.join("dep.f.js"), dir.path("link.f.js")).unwrap();
            symlink(&raw, dir.path("link-dir")).unwrap();
            assert_eq!(
                path_text(&raw).unwrap_err().kind(),
                std::io::ErrorKind::InvalidData
            );
            let parent = path_to_file_url(&dir.path("main.f.js"));
            for name in ["link.f.js", "link-dir/dep.f.js"] {
                let entry = resolve_file_module(&dir.path(name), None).unwrap_err();
                let import = resolve_file_module(name, Some(&parent)).unwrap_err();
                for error in [entry, import] {
                    assert!(
                        error
                            .message
                            .contains("non-UTF-8 module paths are not supported")
                    );
                }
            }
            let valid = resolve_file_module(&replacement, None).unwrap();
            assert_eq!(valid.path, replacement);
            assert_eq!(file_url_to_path(&valid.id).unwrap(), valid.path);
            assert_eq!(fs::read(&valid.path).unwrap(), b"replacement");
            assert_eq!(fs::read(dir.path("link.f.js")).unwrap(), b"original");
        }

        #[test]
        fn escaped_whitespace_names_remain_literal() {
            let dir = Scratch::new("url-whitespace");
            let parent = path_to_file_url(&dir.path("main.f.js"));
            for (name, encoded, plain) in [
                ("dep ", "dep%20", "dep"),
                ("a\tb", "a%09b", "ab"),
                ("a\nb", "a%0Ab", "ab"),
                ("a\rb", "a%0Db", "ab"),
                ("dep\u{1}", "dep%01", "dep"),
            ] {
                fs::write(dir.path(name), "literal").unwrap();
                fs::write(dir.path(plain), "plain").unwrap();
                let literal = resolve_file_module(&dir.path(name), None).unwrap();
                let other = resolve_file_module(plain, Some(&parent)).unwrap();
                assert_ne!(literal.id, other.id);
                assert_eq!(file_url_to_path(&literal.id).unwrap(), literal.path);
                assert_eq!(resolve_file_module(encoded, Some(&parent)).unwrap(), literal);
                let error = resolve_file_module(name, Some(&parent)).unwrap_err();
                assert_eq!(error.message, "invalid module specifier");
            }
            for name in ["a b", "dep\u{a0}"] {
                fs::write(dir.path(name), "literal").unwrap();
                let literal = resolve_file_module(&dir.path(name), None).unwrap();
                assert_eq!(resolve_file_module(name, Some(&parent)).unwrap(), literal);
            }
        }

        #[test]
        fn a_link_resolves_to_its_target() {
            let dir = Scratch::new("link");
            fs::create_dir_all(dir.path("real")).unwrap();
            fs::write(dir.path("real/m.f.js"), "").unwrap();
            symlink(dir.path("real"), dir.path("link")).unwrap();
            let via = resolve_file_module(&dir.path("link/m.f.js"), None).unwrap();
            assert_eq!(via.path, dir.path("real/m.f.js"));
            // Imports are resolved from the importer's real directory.
            let next = resolve_file_module("./m.f.js", Some(&via.id)).unwrap();
            assert_eq!(next, via);
        }

        #[test]
        fn a_missing_module_is_enoent() {
            let dir = Scratch::new("missing");
            let Err(info) = resolve_file_module(&dir.path("none.f.js"), None) else {
                panic!("a missing module resolved")
            };
            assert_eq!(info.code, Some("ENOENT".into()));
            assert!(
                info.message
                    .ends_with(&format!("realpath '{}'", dir.path("none.f.js"))),
                "{}",
                info.message
            );
            let Err(info) =
                resolve_file_module("./none.f.js", Some(&path_to_file_url(&dir.path("a.f.js"))))
            else {
                panic!("a missing module resolved")
            };
            assert_eq!(info.code, Some("ENOENT".into()));
        }

        #[test]
        fn a_relative_path_is_from_the_working_directory() {
            let here = std::env::current_dir().unwrap();
            let module = resolve_file_module("Cargo.toml", None).unwrap();
            assert_eq!(
                module.path,
                fs::canonicalize(here.join("Cargo.toml"))
                    .unwrap()
                    .to_string_lossy()
            );
        }
    }
}
