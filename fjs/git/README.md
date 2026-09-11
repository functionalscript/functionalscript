# Git objects

Readers and writers for Git's objects — `blob`, `tree`, `commit`, `tag` —
as typed values over bytes, built on the EBNF front end over the byte
alphabet ([`fjs/ebnf/byte`](../ebnf/byte/README.md)). The two DISOT issues
under [`todo/`](../../todo/) build on Git and neither can start without
reading Git objects as typed values: [git-name-resolution](../../todo/git-name-resolution.md)
resolves a name by reading the root entries of a commit's tree and one
blob under it, and [git-trusted-timestamp-signatures](../../todo/git-trusted-timestamp-signatures.md)
reconstructs a commit's signed payload from its headers and writes a
commit back. This directory is the decoder, and this file is the record of
what a grammar can and cannot do for the formats.

- [`object/`](object/module.f.mjs) — the loose object envelope,
  `<type> SP <size> NUL`: a grammar up to the NUL, a reader that slices the
  payload and holds it to the size, and a writer.
- [`header/`](header/module.f.mjs) — the header block a commit and a tag
  share, and the message after it: a generic grammar over `key SP value LF`
  lines with continuation, a reader to a header list, the lookups by
  position and by key, and a writer that returns the block byte for byte.
- [`ident/`](ident/module.f.mjs) — an `author`, `committer` or `tagger`
  value, `name SP <email> SP time SP tz`, read as a second pass over the
  bytes a header holds: a `try*` reader that refuses what `git fsck`
  refuses, and a writer.
- [`tree/`](tree/module.f.mjs) — a tree's entries, `mode SP name NUL id`,
  for a repository's id width: a reader that reads what `git fsck` would
  flag, a `validate` that refuses it the way `fsck` does, `mode` as the
  number an entry's digits spell, and a writer.
- [`tag/`](tag/module.f.mjs) — a tag as a second pass over the header
  block: `object`, `type`, `tag` and `tagger` as functions over the header
  list, read by position as Git reads them, and a `validate`.
- [`commit/`](commit/module.f.mjs) — a commit the same way: `tree`,
  `parent`, `author` and `committer` by position, `encoding`, `gpgsig` and
  `mergetag` by key, the last read as a tag by the tag module, and a
  `validate`.
- [`oid/`](oid/module.f.mjs) — an object id between its two spellings, the
  raw bytes a tree entry holds and the hex text a header holds, and `of`,
  the id an object has at the repository's width: SHA-1 at 20 bytes,
  SHA-256 at 32.
- [`loose/`](loose/module.f.mjs) — a loose object file read through the
  host's `inflate` effect and past its envelope: the one place a real
  repository meets the decoder.
- [`config/`](config/module.f.mjs) — the repository's `config` as
  `(section, key, value)` entries, read a character at a time as Git's own
  parser reads it — quoted values and their escapes, a header that ends
  mid-line, a key without a value — and the id width it names:
  `extensions.objectFormat` absent is SHA-1, `sha256` under
  `repositoryformatversion = 1` is SHA-256, and what Git refuses is
  refused.
- [`store/`](store/module.f.mjs) — from an id to the object it names,
  checked: the loose file at the id's path, hashed with `oid`'s `of` and
  refused where the hash is not the id; and the width from `config`.
  Loose objects only, until packs.
- [`walk/`](walk/module.f.mjs) — the three steps from a name to bytes,
  over whatever reads objects: `peel`, a tag to what it names;
  `tryEntries`, a commit or a tree to the entries of its tree; and
  `tryEntry`, the entry a path names. It reads no object it need not, so
  a path naming a submodule answers that entry, and it refuses what a
  corrupt repository makes ambiguous: a tag whose target is not the type
  it declared, a tree naming one name twice, and a path descending through
  an entry that is no `40000` subtree.
- `types.ts` — `Bytes`, the type of a field the format leaves unbounded,
  `Oid` and `OidBytes`, the one fixed-width field and its width, and
  `ObjectType`.
- `testlib.f.mjs` — objects Git wrote, checked in as bytes and each
  carrying the id Git gave it: a signed merge commit of this repository
  and its root tree, and from a scratch repository a signed tag, a merge
  of one with the tag whole in `mergetag`, a tree with every mode, that
  tag's loose file, and a commit and a tree under SHA-256. Nothing in code
  calls `git`.

## The formats

A loose object is one zlib stream. Inflated, it is an ASCII header and the
payload, and the object id is the hash of the inflated whole:

```text
<type> SP <size> NUL <payload>
```

`type` is one of `blob`, `tree`, `commit`, `tag`; `size` is the payload
length in decimal ASCII. The hash is SHA-1 in today's repositories and
SHA-256 after the [hash-function transition](https://git-scm.com/docs/hash-function-transition),
so an object id is 20 or 32 raw bytes, and every hex spelling of one is 40
or 64 characters. Which of the two a repository uses is a property of the
repository, not of any object — every reader that meets an id is
parameterized by it, `OidBytes`, a number since `times` takes its bound as
one.

The four payloads:

- **blob** — the file content, arbitrary bytes. Nothing to parse, and no
  module: a blob's payload is what the envelope reader hands back.
- **commit** — a header block, an empty line, and the message:

  ```text
  tree <hex>
  parent <hex>              zero or more
  author <ident>
  committer <ident>
  encoding <name>           optional
  gpgsig <first line>       optional; continued on lines that begin with SP
   <continuation line>
  <other headers>           mergetag, and any header a tool adds

  <message>                 to the end of the object, arbitrary bytes
  ```

  Every header is `key SP value LF`, and a line beginning with SP continues
  the value of the header before it, LF included. That is how a multi-line
  signature is one header, and how `mergetag` carries a whole tag object as
  its value. Git reads `tree`, `parent`, `author` and `committer` by
  position and ignores a header it does not know; the ones it knows are
  checked after, not by the line reader.
- **tag** — the same shape: `object <hex>`, `type <type>`, `tag <name>`,
  `tagger <ident>` (absent in very old tags), other headers, an empty line,
  the message. A signature is part of the message, from the line that
  begins its armor to the end.
- **tree** — a sequence of entries, no separators, no terminator:

  ```text
  <mode> SP <name> NUL <id>
  ```

  `mode` is octal ASCII without padding — `100644`, `100755`, `120000`,
  `160000`, and `40000` for a subtree, five digits, not six. `name` is any
  bytes but NUL; a slash is forbidden by `git fsck`, not by the reader.
  `id` is the raw object id, 20 or 32 bytes, every byte value allowed, and
  it is what delimits the entry: nothing follows it but the next entry or
  the end.

An `ident` is `name SP < email > SP time SP tz`: the name any bytes but the
brackets and LF, spaces included; the email the same; `time` a decimal Unix
timestamp Git can hold; `tz` a sign and four digits.

The object formats are specified across
[gitformat-pack](https://git-scm.com/docs/gitformat-pack),
[gitformat-signature](https://git-scm.com/docs/gitformat-signature) and the
[Git Internals](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects)
chapter; the loose object envelope has no document of its own beyond
`object-file.c`.

## A grammar over bytes, for the delimiter-framed parts

The repository has two ways to read a binary format, and the choice
between them follows the framing:

- **Delimiter-framed** structure — a field ends at a byte the grammar can
  name, or after a fixed count — is what a grammar is for, and
  [`fjs/ebnf/`](../ebnf/) plus its LL(1) backend is the tool. Commit and
  tag payloads are lines, headers, and one empty line; a tree entry is two
  delimiters and a fixed-width id. All of it is LL(1).
- **Length-framed** structure — a field's extent is a number read from an
  earlier field — is not context-free, and [`fjs/asn.1/`](../asn.1/) is
  the precedent: a hand-written decoder over a `Vec`, `popFront` by
  `popFront`. A zlib stream and a packfile are this kind, and they get a
  decoder, not a grammar.

The loose envelope is both: the NUL is a delimiter, so a grammar reads the
header and stops there, leaving the rest as the payload, and the size is a
claim about that rest, which the reader verifies and refuses when it does
not match ([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
That is what Git does too: the size is a check, not what delimits the
payload.

| structure | framing | reader |
|---|---|---|
| commit, tag payload | SP, LF, an empty line | grammar |
| tree payload | SP, NUL, then `times(n)(byte)` | grammar, parameterized by the id width |
| loose envelope | NUL, then a size that describes the rest | grammar up to the NUL; the reader slices the rest and checks the size |
| blob | none | none |
| zlib stream | bit-level, length-framed | the host's `inflate`, until [`todo/inflate.md`](../../todo/inflate.md) |
| packfile, `.idx` | varints, deltas, zlib | a decoder, [`todo/packfiles.md`](todo/packfiles.md) |

**The alphabet is bytes, not Unicode.** A Git object is not text: the id in
a tree entry is 20 raw bytes and may spell anything, a file name is
whatever bytes the file system gave, a message is in the charset the
`encoding` header names or in none, and an old commit's ident may not be
valid UTF-8 at all. Decoding the object to code points first would either
fail on a valid object or substitute `U+FFFD` into it — the plausible wrong
value [DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
forbids — and it would lose the bytes the trusted-timestamp work hashes. So
the parser's symbols are bytes, `0..255`, and every value it extracts that
is not a number is bytes — a `Vec` where the format fixes the width, a byte
list where it does not. A text view of a message or a name is a layer
above, through [`fjs/text/utf8`](../text/utf8/), when a consumer wants one
and only for the encoding the object declares. That alphabet is
[`fjs/ebnf/byte`](../ebnf/byte/README.md), landed for this consumer; its
symbols are non-negative safe integers with EOF at `-1`, so a byte is an
ordinary symbol and no byte has to stand in for the end of input.

**Where LL(1) is not enough, the answer is another pass, not a stronger
parser.** One lookahead byte cannot tell `tree` from `tag`, a known header
from an unknown one, or a name from the space before its `<`; it does not
have to. The first pass reads the shape every object shares and understands
none of it — a word, a header line, a value up to its delimiter — and a
later pass reads what the first one cut out: the header list is interpreted
after the parse, an ident is a grammar over one header's value, and a
`mergetag` value is a tag object read by the tag grammar. Each pass is a
grammar over the previous pass's output, which is the layering
[layered-parser](../ebnf/todo/layered-parser.md) describes, so the machinery
is one LL(1) backend applied more than once rather than a backend that
backtracks. It is also how Git reads its own objects. Three places show the
principle at its sharpest:

- The envelope's `type` is one word up to the space, with the mapping
  accepting the four types and refusing any other word: a variant of the
  four keywords is not LL(1), since `tree` and `tag` share their first
  byte.
- The header block is generic, the way Git's own reader is. A variant over
  the known keys would conflict with the unknown-header branch on every
  first byte, and would refuse a commit the moment a tool adds a header.
- An ident's name is read up to `<`, and the reader requires its last byte
  to be SP and drops it: the name's repetition may end in SP, so `' <'`
  after it is a first/follow conflict the backend refuses.

The `mergetag` pass has one loss, and it is the fold's. Git folds a tag
into the header by putting SP before each of the tag's lines and
completing the last, so the LF that ends the tag ends the header too and
the header's framing takes it; the commit module gives it back, and every
tag a tool of Git's writes comes back byte for byte, its id recomputable.
A tag whose own bytes never ended in LF — one `git hash-object -t tag`
writes and `git tag` and `git mktag` never do — folds to the same header
as the same tag with one, so nothing in the commit can tell them apart:
no representation is possible, and refusing would refuse a commit `git
fsck` accepts. Giving the LF back is the choice because it is Git's own:
`show_one_mergetag`, behind `git verify-commit` and `git log
--show-signature`, hashes the value with the LF its reader keeps on every
line, and so loses the same tag the same way. The bytes here are the
bytes Git reads back.

## The values

An id, a name, an email, a header and a message are bytes, and which byte
type a field has follows from whether the format bounds it:

```ts
type Bytes = List<number>                         // unbounded, one byte per item
type Oid = Vec                                    // 20 or 32 bytes, raw
type OidBytes = 20 | 32                           // the repository's width
type ObjectType = 'blob' | 'tree' | 'commit' | 'tag'
type Ident = { name: Bytes, email: Bytes, time: bigint, tz: string }
type Header = readonly [key: Bytes, value: Bytes]
type Commit = { headers: readonly Header[], message: Bytes }
type Tag = { headers: readonly Header[], message: Bytes }
type TreeEntry = { mode: Bytes, name: Bytes, oid: Oid }
```

A `Vec` holds at most 128 KiB, so it is the type of a field the format
bounds — an id — and a byte list is the type of one it does not: a message
runs to the end of the object, a header value may hold a whole tag, and a
name is whatever the file system gave. Where a `Vec` is built, it is built
with `tryU8ListToVec` and a `null` is refused, never truncated
([DESIGN.md §6](../../doc/DESIGN.md#6-never-precompute-a-size-to-predict-whether-something-fits)).
A header's key is bytes too, not a string: the grammar reads any byte but
SP and LF, Git accepts what it reads, and a reader that promises the block
byte for byte cannot then refuse a key for its spelling. The well-known
keys are compared as bytes.

A commit and a tag are their header list and their message, and nothing
else: one representation, so there is no second one for a writer to choose
over or a caller to leave stale. `headers` keeps every header as read, the
well-known ones included, in order and byte for byte, because the
signature work needs the block verbatim to reconstruct a payload, and a
header the reader does not know must survive a read and a write unchanged.
The well-known fields — `tree`, `parents`, `author`, `committer`, `object`,
`type`, `name`, `tagger` — are functions over the headers, total once
`validate` has accepted the object and a panic on one it has not; a change
to a commit is a change to its headers, and the writer serializes what it
is given.

A tree entry's mode is kept as the digits it was spelled with, since
`0100644` and `100644` are one number and two spellings — Git writes the
unpadded one and `git fsck` only warns about the other, so both exist —
and a writer owes the spelling it read. `mode` reads the number off it as
Git keeps it, the low 32 bits, and `validate` refuses the padded spelling
as `fsck`'s `zeroPaddedFilemode` flags it: the reader reads such an entry
and the writer returns it byte for byte, and only the check that vouches
for an object says no to it.

## Reading is one thing and vouching another

Every reader is a `try*` returning `null` for what its grammar does not
cover, and reads everything its grammar does, an object `git fsck` would
flag included; the writer returns it byte for byte. `validate`, one per
object type, is where an object is refused, naming why, by the rules
`fsck` applies: required headers and their order, a hex id of the
repository's width, an ident where one is required, a NUL in a header,
the mode set, the entry order. Those are what `fsck` reports as an error.
Three things it only warns of are refused as well, as this module's own
choice, each said where it is made: a tag name no ref takes, which
`git mktag` refuses to write; a NUL in a commit's message, which no tool
of Git's writes; and a zero-padded tree mode, `zeroPaddedFilemode`, which
the paragraph above this one explains. What `fsck` only notes and Git
writes passes. The
one check `fsck` does not make: a `mergetag` must be a tag the tag module
vouches for, so that `mergetags` is total. The
ident reader is the exception that refuses at the grammar: Git's own reader
is lenient and old history holds idents without an email or with a
malformed zone, and this reader reads what `fsck` vouches for, a time Git
can hold included, and refuses the rest, not repairing it; the raw header
stays in the list either way, and which of those forms are worth accepting
is decided when one is met, as an issue naming the object.

## What is not here

Each is a limit stated, refused where it is crossed, and none approximated:

- **An inflater.** The parser is pure over the inflated bytes whatever
  supplies them; today `inflate` in [`fjs/effects/node`](../effects/node/module.f.mjs)
  supplies them from `node:zlib` at the host boundary, and
  [`loose/`](loose/module.f.mjs) is its caller. A FunctionalScript inflater
  is [`todo/inflate.md`](../../todo/inflate.md).
- **A repository found.** `store` reads one object by id and `walk` walks
  from one to a blob, but both take the repository's directory as the
  caller gives it: finding it through a `.git` file's `gitdir` and a
  `commondir`, and `objects/info/alternates`, are the rest of
  [`todo/object-store.md`](todo/object-store.md). What the id check means
  in a SHA-1 repository, and what a trust layer does about a hash that can
  collide, is
  [`todo/git-sha1-collisions.md`](../../todo/git-sha1-collisions.md).
- **Packfiles**, where most objects in a real clone live, so the loose
  reader alone reads a fresh clone poorly: [`todo/packfiles.md`](todo/packfiles.md).
- **Refs**, from a name to an id: [`todo/refs.md`](todo/refs.md).
- **The `Vec` ceiling.** `maxLength` in `fjs/types/bit_vec` is `2^20` bits,
  128 KiB, and nothing the format leaves unbounded is safe from it, which
  is why every unbounded field is a byte list. Where it binds today is the
  boundary: the host's `inflate` takes a `Vec` and gives one, and
  `readFile` ahead of it takes one too, so a loose object is refused on
  either side of its stream — a file over the bound before inflating, a
  stream that inflates past it — and never cut short. The inflater issue
  lifts both sides.
- **An object with no empty line.** A commit or a tag whose bytes end
  after its last header, which Git accepts and none of its tools write,
  is refused by the header block's grammar; reading it is a change to
  `Payload`, [`header/todo/header-only-object.md`](header/todo/header-only-object.md).
- **One `Meta` per byte.** The LL(1) backend takes an array of symbols,
  each an object, and streams nothing. For commits, tags and trees that is
  fine; it is the reason a blob is never handed to a parser.

## Related

- [git-name-resolution](../../todo/git-name-resolution.md) — the first
  consumer: the root entries of a commit's tree, and one blob under it.
- [git-trusted-timestamp-signatures](../../todo/git-trusted-timestamp-signatures.md)
  — every header verbatim, and the writer.
- [`doc/DESIGN.md`](../../doc/DESIGN.md#the-worked-example-fjsebnf-replacing-fjsbnf)
  — the ebnf migration, which reserved `fjs/ebnf/byte/` for the first
  consumer that wanted it, this one, and is recorded there now that its
  plan is done.
- [unicode-rules](../ebnf/unicode/todo/unicode-rules.md) — the byte adapter's first
  design, as the half of that issue the text half left behind.
- [layered-parser](../ebnf/todo/layered-parser.md) — bytes as the bottom
  alphabet of the pipeline; ident and `mergetag` are layers over it.
- [`fjs/ebnf/ll1/README.md`](../ebnf/ll1/README.md) — the backend, its
  conflicts, and the rewrite set the mappings are written against.
- [`fjs/asn.1`](../asn.1/module.f.mjs) — the length-framed precedent, the
  shape a packfile decoder takes.
