import { assertStructurallySame } from '../../asserts/module.f.mjs'
import { alternatesIn } from './module.f.mjs'

export const proof = {
    // A comment, a blank line and a path with no trailing newline: the three
    // shapes the file takes that are not one plain line. Every rule measured on
    // Git 2.43.0 — a `#` line prints nothing where a nonexistent directory
    // prints `error: unable to normalize alternate object path`, and a file with
    // no trailing newline names its last directory all the same.
    alternatesLines: () => {
        assertStructurallySame(
            alternatesIn('od', '# a comment\n\n../other/objects\n'),
            ['od/../other/objects'])
        assertStructurallySame(alternatesIn('od', 'a/objects'), ['od/a/objects'])
        assertStructurallySame(alternatesIn('od', ''), [])
        // a colon is not a separator: the whole line is one path, measured — Git
        // named the colon-joined string in its error
        assertStructurallySame(alternatesIn('od', 'a:b'), ['od/a:b'])
    },
    // A quoted line is C-quoted and its escapes decoded, measured: `"/no\tsuch"`
    // made Git name a directory with a real tab in it. An unterminated quote is
    // not a quoted line at all — Git took `"/some/path` verbatim, leading quote
    // included, so this does too.
    alternatesQuoting: () => {
        assertStructurallySame(alternatesIn('od', '"/a b/objects"'), ['/a b/objects'])
        assertStructurallySame(alternatesIn('od', '"/no\\tsuch"'), ['/no\tsuch'])
        assertStructurallySame(alternatesIn('od', '"/a\\101b"'), ['/aAb'])
        // and the shapes that are not a quoted line, each taken as it stands
        assertStructurallySame(alternatesIn('od', '"/unterminated'), ['od/"/unterminated'])
        // a line taken verbatim is taken as written, backslashes and all: the
        // path is no longer folded, so nothing rewrites one into a separator
        assertStructurallySame(alternatesIn('od', '"/bad\\qescape"'), ['od/"/bad\\qescape"'])
        assertStructurallySame(alternatesIn('od', '"/short\\12"'), ['od/"/short\\12"'])
        // an `8` or a `9` is no octal digit, so `\\089` is no escape: the one
        // input that pins the digit range, since a wider `isOctal` would read
        // it as `\\000` and cut the path at the `NUL` that names
        assertStructurallySame(alternatesIn('od', '"/a\\089b"'), ['od/"/a\\089b"'])
        // `\\400` and above name no byte, so the unquoting fails and the line is
        // taken as it stands — measured on Git 2.43.0, `"x\\400"` read objects
        // from a directory named `"x\\400"`, quotes and all. Truncating to a byte
        // or refusing the file would each make that repository unreadable.
        assertStructurallySame(alternatesIn('od', '"x\\400"'), ['od/"x\\400"'])
        assertStructurallySame(alternatesIn('od', '"x\\777"'), ['od/"x\\777"'])
        // while `\\377` is a byte, and the one this layer cannot spell
        assertStructurallySame(alternatesIn('od', '"x\\377"'), ['od/x\u00FF'])
        // text after the closing quote gives the quoted path — see
        // `alternatesQuotedSuffix` in `fjs/git/store`'s proof for the entry Git
        // also makes of the rest
        assertStructurallySame(alternatesIn('od', '"/after" and more'), ['/after'])
        assertStructurallySame(alternatesIn('od', '"/trailing\\'), ['od/"/trailing\\'])
    },
    // A path ends at its first `NUL`, which is the rule Git and the system call
    // both follow. Measured on Git 2.43.0 with the donor's store at
    // `<donor>/.git/objects`:
    //
    // | line | `git cat-file -p` |
    // | --- | --- |
    // | `"<donor>/objects"` | exit 0, the blob |
    // | `"<donor>/objects\000x"` | exit 0, the blob |
    // | `"<donor>/objectsx"` | exit 128 |
    // | `"<donor>/objects\001x"` | exit 128 |
    //
    // So the `\000` ends the path and the `x` behind it is never looked at,
    // while any other character is part of the name.
    //
    // **Carrying the `NUL` through would be a refusal, not a miss**, which is
    // what makes this worth doing rather than recording. Node will not hand a
    // path with one to the system call: every `fs` operation throws
    // `TypeError [ERR_INVALID_ARG_VALUE]`, `fjs/effects/node` turns that into a
    // channel error carrying the code, and `ERR_INVALID_ARG_VALUE` is not
    // `ENOENT` — so `fjs/git/store` would read it as a store that holds the
    // object and cannot give it up, and refuse the whole read of a repository
    // Git reads.
    alternatesNul: () => {
        const nul = String.fromCharCode(0)
        assertStructurallySame(alternatesIn('od', '"/donor/objects\\000x"'), ['/donor/objects'])
        // the other road in: a raw `0x00` in a file's own bytes, which the
        // decoder gives back as the same character
        assertStructurallySame(alternatesIn('od', `donor/objects${nul}x`), ['od/donor/objects'])
        // a line with nothing before its `NUL` names no directory, so it is
        // skipped as an empty line is rather than naming the store itself
        assertStructurallySame(alternatesIn('od', '"\\000x"'), [])
        assertStructurallySame(alternatesIn('od', `${nul}x`), [])
        // and the `NUL` decides before the root does: what is left is what is
        // asked whether it stands on its own
        assertStructurallySame(alternatesIn('od', `/a${nul}/b`), ['/a'])
    },
    // An octal escape naming a byte above ASCII decodes to one *character* of
    // that value, which the host writes back as two UTF-8 bytes — so the
    // directory opened is not the one the file names. A miss and not a refusal,
    // for the reason `alternatesNotUtf8` in `fjs/git/store`'s proof gives.
    alternatesHighOctal: () => {
        assertStructurallySame(alternatesIn('od', '"/tmp/\\377/objects"'), ['/tmp/\u00FF/objects'])
        // `\177` is ASCII and spells a path this layer holds exactly
        assertStructurallySame(alternatesIn('od', '"/a\\177b"'), ['/a\x7Fb'])
        // and every other place `\377` can appear is four ordinary characters
        // Git reads as a path — measured at exit 0 for all three
        assertStructurallySame(alternatesIn('od', '# \\377\n/a/objects\n'), ['/a/objects'])
        assertStructurallySame(alternatesIn('od', '/tmp/\\377/objects'), ['/tmp/\\377/objects'])
        assertStructurallySame(alternatesIn('od', '"/a"\\377'), ['/a'])
        // a path that is simply not ASCII is already UTF-8, so the host writes
        // back the bytes it came from
        assertStructurallySame(alternatesIn('od', '/tmp/é/objects'), ['/tmp/é/objects'])
    },
    // A drive-rooted entry names a directory on its own only where the store
    // itself is drive-rooted. `C:/donor/objects` is an absolute path on Windows
    // and a directory named `C:` on POSIX, and nothing in the line says which —
    // the object directory holding the file does.
    //
    // Measured on Git 2.43.0 on POSIX: a borrower with an entry of `C:` and the
    // donor's objects copied to `objects/C:` read the blob, so the POSIX reading
    // is a directory name. Without the test, such an entry would go to the host
    // as absolute and be resolved against the *process* directory — a third
    // place, named by nobody.
    alternatesDriveRoot: () => {
        assertStructurallySame(
            alternatesIn('/home/r/objects', 'C:/donor/objects'),
            ['/home/r/objects/C:/donor/objects'])
        assertStructurallySame(
            alternatesIn('C:/r/.git/objects', 'C:/donor/objects'),
            ['C:/donor/objects'])
        // a relative store is no drive either
        assertStructurallySame(alternatesIn('od', 'C:/donor/objects'), ['od/C:/donor/objects'])
        // A drive is named by a letter, as `fjs/path` reads one, so on a
        // drive-rooted store `1:` and `::` are ordinary names below `objects/`
        // rather than roots handed to the host.
        assertStructurallySame(
            alternatesIn('C:/r/.git/objects', '1:/donor/objects'),
            ['C:/r/.git/objects/1:/donor/objects'])
        assertStructurallySame(alternatesIn('C:/r/.git/objects', '::'), ['C:/r/.git/objects/::'])
        // while a drive with no `/` after it is one, as Git's drive prefix is
        assertStructurallySame(alternatesIn('C:/r/.git/objects', 'D:x'), ['D:x'])
        // and a leading backslash is the same question: a separator on Windows,
        // an ordinary first character of a name on POSIX. Measured on Git
        // 2.43.0, an entry of `\\x` read objects from `objects/\\x`.
        assertStructurallySame(alternatesIn('/home/r/objects', '\\x'), ['/home/r/objects/\\x'])
        assertStructurallySame(alternatesIn('C:/r/.git/objects', '\\x'), ['\\x'])
        // and the two roots that are roots everywhere
        assertStructurallySame(alternatesIn('/home/r/objects', '/donor/objects'), ['/donor/objects'])
        assertStructurallySame(alternatesIn('/home/r/objects', '//unc/objects'), ['//unc/objects'])
        // A `//` root is *not* evidence of Windows, although a UNC share begins
        // with one: it is a legal POSIX root too, and Linux resolves `//tmp/r`
        // as `/tmp/r`. Measured on Git 2.43.0, a borrower opened through
        // `//<tmp>/b` read a `C:/donor/objects` entry as a name below its own
        // `objects/` and answered the blob at exit 0.
        //
        // A revision that counted `//` as Windows sent that entry to the host
        // unprefixed, where node resolves it against the *process* directory —
        // the third place named by nobody that the drive-root test exists to
        // prevent. What it costs is the mirror case, a Windows store on a UNC
        // share, which now reads these as relative and misses the donor; a miss
        // below a directory the file named beats a lookup nobody asked for.
        assertStructurallySame(
            alternatesIn('//srv/share/r/.git/objects', 'C:/donor/objects'),
            ['//srv/share/r/.git/objects/C:/donor/objects'])
        assertStructurallySame(
            alternatesIn('//srv/share/r/.git/objects', '\\x'),
            ['//srv/share/r/.git/objects/\\x'])
    },
}
