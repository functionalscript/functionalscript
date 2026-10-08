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
//! ASCII.

use crate::files::{IoError, normalize};
use std::{fs, path::Path};

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
    // `/C:/a` is the drive path `C:/a`.
    let drive = path.as_bytes();
    Ok(
        if drive.len() >= 3 && drive[2] == b':' && drive[1].is_ascii_alphabetic() {
            path[1..].to_string()
        } else {
            path
        },
    )
}

/// `pathToFileURL` of an absolute path.
pub fn path_to_file_url(path: &str) -> String {
    let path = path.replace('\\', "/");
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

/// The real native path, without a Windows drive's extended-length prefix.
/// Check again after canonicalization: a local link may resolve to a UNC path.
fn real_path(path: &str) -> std::io::Result<String> {
    let real = fs::canonicalize(path)?.to_string_lossy().into_owned();
    if cfg!(windows) {
        windows_path(&real).map(str::to_string)
    } else {
        Ok(real)
    }
}

/// The directory of a path, and the path itself where it has none.
fn directory(path: &str) -> &str {
    path.rfind('/').map_or("", |i| &path[..i])
}

/// The module `name` names, from the file `parent`'s identity, or from the
/// working directory where there is none: the real path and its identity.
pub fn resolve_file_module(name: &str, parent: Option<&str>) -> Result<FileModule, IoError> {
    let loading = match parent {
        None => {
            let absolute = if Path::new(name).is_absolute() {
                name.to_string()
            } else {
                let here =
                    std::env::current_dir().map_err(|e| crate::files::failure(&e, "cwd", name))?;
                format!("{}/{name}", here.to_string_lossy())
            };
            // Inspect the native spelling before normalize turns backslashes
            // into slashes. This also covers a UNC working directory.
            let absolute = if cfg!(windows) {
                windows_path(&absolute)
                    .map_err(|e| crate::files::failure(&e, "resolveFileModule", &absolute))?
            } else {
                &absolute
            };
            normalize(absolute)
        }
        Some(parent) => {
            let invalid = || refusal(None, "invalid module specifier");
            let (rooted, names) = decode_specifier(name).ok_or_else(invalid)?;
            let importer = file_url_to_path(parent)?;
            if rooted && names.starts_with('/') {
                // `//x/y` is a network path, not a path on this machine.
                return Err(invalid());
            }
            if rooted {
                normalize(&format!("/{names}"))
            } else if names.is_empty() {
                normalize(&importer)
            } else {
                normalize(&format!("{}/{names}", directory(&importer)))
            }
        }
    };
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
        assert_eq!(path_to_file_url("C:\\a\\b"), "file:///C:/a/b");
        assert_eq!(
            file_url_to_path("file:///a/b%20c"),
            Ok("/a/b c".to_string())
        );
        assert_eq!(file_url_to_path("file:///C:/a"), Ok("C:/a".to_string()));
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
