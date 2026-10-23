# Path

Portable path strings: one set of rules for POSIX, UNC and Windows drive
paths, with no file system behind them. Every function here is lexical, so it
answers from the text alone.

## The model

A path is a root followed by segments. The root is `/`, `//` for a UNC path,
`C:/` for a drive, or nothing for a relative path. It is not a segment, and
`..` cannot climb above it. Both `/` and `\` separate segments. Every
function that normalizes (`normalize`, `parse`, `root`, `concat`) answers
with `/`; the string helpers `join`, `under` and `relativize` only splice
text, so a `\` already in their input stays.

```js
import { normalize, parse, root, escapes } from './module.f.mjs'

normalize('/a/./b/../c')  // '/a/c'
normalize('/../x')        // '/x': nothing above the root
normalize('a/../../x')    // '../x': a relative path keeps its climb
escapes('a/../../x')      // true
root('C:/x')              // 'C:/'
root('//srv/x')           // '//'
parse('/a/b')             // ['a', 'b']: segments only, no root
```

A Windows path reads the same way:

```js
parse('C:\\a\\..\\b')     // ['b'], and its root is 'C:/'
```

## Functions

| Function | Use it for |
|---|---|
| `normalize` | one canonical spelling of a path, root kept |
| `parse` | the normalized segments, root dropped |
| `root` | whether, and how, a path is absolute |
| `escapes` | whether a relative path climbs above where it starts |
| `concat(a)(b)` | `b` resolved against `a`; an absolute `b` replaces `a` |
| `parent` | the directory a path is in; `parent('/')` is `/`, `parent('x')` is `.` |
| `basename` | the last segment, or `''` for a root |
| `ancestors` | every directory above a path, outermost first |
| `join(...segments)` | segments joined with `/`, with no normalization |
| `under(dir, name)` | a name below a directory that came from outside |
| `relativize(base, path)` | `path` as `./...` when it starts with `base` |
| `isProperPrefix` | whether one segment list is a strict ancestor of another |
| `toPosix` | `\` replaced by `/`, nothing else |

```js
concat('a/b')('../c')   // 'a/c'
concat('a/b')('/c')     // '/c'
ancestors('/a/b/c')     // ['/a', '/a/b']
basename('a/b/x.rs/')   // 'x.rs'
join('a', '..', 'b')    // 'a/../b': join does not fold
```

Use `concat` when the answer should be normalized and `join` when the segments
are already clean. Use `under` instead of `join` for a directory read from a
file or the environment: it refuses a bare drive such as `C:`, which is not a
directory.

## Import specifiers

[`import/module.f.mjs`](./import/module.f.mjs) reads an `import` specifier as
a URL path and resolves it against the importing file.

```js
import { specifierKind, resolve } from './import/module.f.mjs'

specifierKind('./x')                   // 'relative'
specifierKind('node:fs')               // 'bare': not a path
resolve('src/a.js')('../lib/%20b.js')  // 'lib/ b.js'
resolve('src/a.js')('./x?y')           // null: a URL suffix is refused
```

Dot segments fold before percent-decoding, and colons, backslashes, `?`, `#`
and a leading `//` are refused, so a specifier can never name a drive, a
network path or a parent of the root.

## See also

- [`todo/`](./todo/) and [`import/todo/`](./import/todo/): known gaps.
