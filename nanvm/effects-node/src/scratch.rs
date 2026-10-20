//! A fresh directory for a test that touches the file system, removed when
//! the guard is dropped, so a failed assertion leaves nothing behind.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicUsize, Ordering},
};

/// A fresh directory under the system's, removed when dropped.
pub(crate) struct Scratch(PathBuf);

impl Scratch {
    /// A directory named by `name`, the process and a count, so that tests
    /// running at once never share one.
    pub(crate) fn new(name: &str) -> Self {
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let n = NEXT.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "nanvm-effects-node-{name}-{}-{n}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        // The system's temporary directory may itself be a link, and a
        // resolved module is the real path. Windows' real path is a verbatim
        // `\\?\` one, which takes no `/`, so there it stays as it is.
        #[cfg(unix)]
        let path = fs::canonicalize(path).unwrap();
        Self(path)
    }

    pub(crate) fn path(&self) -> &Path {
        &self.0
    }

    /// The path of `name` in the directory, as the operations take it.
    pub(crate) fn at(&self, name: &str) -> String {
        self.0.join(name).to_string_lossy().into_owned()
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
