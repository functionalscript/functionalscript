## Parse Git objects

**Priority:** P3
**Status:** open

### Problem

Two issues in this directory build on Git and neither can start without
reading Git objects as typed values:

- [git-name-resolution](./git-name-resolution.md) resolves a name by reading
  the root entries of a commit's tree and one `.disot.*` blob under it;
- [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
  reconstructs a commit's signed payload from its headers, so it has to read
  every header of a commit — the well-known ones and the ones it adds — and
  write a commit back.

Nothing in the repository reads Git today. There is no decoder for the four
object types, no zlib inflater, and no SHA-1. This issue is the design for the
decoder, and the record of what a grammar can and cannot do for it. Inflate,
SHA-1, and the object store around the objects are named below as their own
work.

### The formats

A loose object is one zlib stream. Inflated, it is an ASCII header and the
payload, and the object id is the hash of the inflated whole:

```text
<type> SP <size> NUL <payload>
```

`type` is one of `blob`, `tree`, `commit`, `tag`; `size` is the payload length
in decimal ASCII. The hash is SHA-1 in today's repositories and SHA-256 after
the [hash-function transition](https://git-scm.com/docs/hash-function-transition),
so an object id is 20 or 32 raw bytes, and every hex spelling of one is 40 or
64 characters. Which of the two a repository uses is a property of the
repository, not of any object — a parser is parameterized by it.

The four payloads:

- **blob** — the file content, arbitrary bytes. Nothing to parse.
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
  its value. Git reads `tree`, `parent`, `author` and `committer` by position
  and ignores a header it does not know; the ones it knows are checked
  after, not by the line reader.
- **tag** — the same shape: `object <hex>`, `type <type>`, `tag <name>`,
  `tagger <ident>` (absent in very old tags), other headers, an empty line,
  the message. A signature is part of the message, from the line that begins
  its armor to the end.
- **tree** — a sequence of entries, no separators, no terminator:

  ```text
  <mode> SP <name> NUL <id>
  ```

  `mode` is octal ASCII without padding — `100644`, `100755`, `120000`,
  `160000`, and `40000` for a subtree, five digits, not six. `name` is any
  bytes but NUL; a slash is forbidden by `git fsck`, not by the reader. `id`
  is the raw object id, 20 or 32 bytes, every byte value allowed, and it is
  what delimits the entry: nothing follows it but the next entry or the end.

An `ident` is `name SP < email > SP time SP tz`: the name is any bytes but
`<` and LF and may contain spaces; the email any bytes but `>`; `time` a
decimal Unix timestamp; `tz` a sign and four digits.

The object formats are specified across
[gitformat-pack](https://git-scm.com/docs/gitformat-pack),
[gitformat-signature](https://git-scm.com/docs/gitformat-signature) and the
[Git Internals](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects)
chapter; the loose object envelope has no document of its own beyond
`object-file.c`.

### Yes to EBNF, over bytes, for the delimiter-framed parts

The repository already has two ways to read a binary format, and the choice
between them follows the framing:

- **Delimiter-framed** structure — a field ends at a byte the grammar can
  name, or after a fixed count — is what a grammar is for, and
  [`fjs/ebnf/`](../fjs/ebnf/) plus its LL(1) backend is the tool. Commit and
  tag payloads are lines, headers, and one empty line; a tree entry is two
  delimiters and a fixed-width id. All of it is LL(1), which the grammar
  sketches below check.
- **Length-framed** structure — a field's extent is a number read from an
  earlier field — is not context-free, and [`fjs/asn.1/`](../fjs/asn.1/) is
  the precedent: a hand-written decoder over a `Vec`, `popFront` by
  `popFront`. A zlib stream and a packfile are this kind, and they get a
  decoder, not a grammar.

The loose envelope is both: the NUL is a delimiter, so a grammar reads the
header and takes the rest as the payload, and the size is a claim about that
rest, which the mapping of the envelope rule verifies and refuses when it does
not match ([DESIGN.md §10](../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
That is what Git does too: the size is a check, not what delimits the payload.

| structure | framing | reader |
|---|---|---|
| commit, tag payload | SP, LF, an empty line | grammar |
| tree payload | SP, NUL, then `times(n)(byte)` | grammar, parameterized by the id width |
| loose envelope | NUL, then a size that describes the rest | grammar; the mapping checks the size |
| blob | none | none |
| zlib stream | bit-level, length-framed | a decoder, its own issue |
| packfile, `.idx` | varints, deltas, zlib | a decoder, later |

**The alphabet is bytes, not Unicode.** A Git object is not text: the id in a
tree entry is 20 raw bytes and may spell anything, a file name is whatever
bytes the file system gave, a message is in the charset the `encoding`
header names or in none, and an old commit's ident may not be valid UTF-8
at all. Decoding the object to code points first would either fail on a
valid object or substitute `U+FFFD` into it — the plausible wrong value
[DESIGN.md §10](../doc/DESIGN.md#10-refuse-what-you-cannot-handle) forbids —
and it would lose the bytes the trusted-timestamp work hashes. So the
parser's symbols are bytes, `0..255`, and every value it extracts that is
not a number is a `Vec` of bytes. A text view of a message or a name is a
layer above, through [`fjs/text/utf8`](../fjs/text/utf8/), when a consumer
wants one and only for the encoding the object declares.

This is the byte alphabet that
[ebnf-migration](../fjs/todo/ebnf-migration.md) lists as `fjs/ebnf/byte/`,
"when a consumer needs it", and the byte half of
[unicode-rules](../fjs/bnf/todo/unicode-rules.md). Git is that consumer, and
the bottom layer [layered-parser](../fjs/bnf/todo/layered-parser.md) draws.

The LL(1) backend already fits the input: its symbols are non-negative safe
integers with EOF at `-1`, so a byte is an ordinary symbol and no byte has
to stand in for the end of input; a message that runs to the end of the
object is `[repeatFrom0(byte), eof]`. The typed AST and the rewrite set are
what turns the tree into values, one mapping per rule, as
[`fjs/media/json/parser`](../fjs/media/json/parser/module.f.mjs) does for
JSON.

### Proposal

#### 1. `fjs/ebnf/byte/` — the byte alphabet

The adapter the migration plan reserves, in the shape of
[`fjs/ebnf/utf16/`](../fjs/ebnf/utf16/module.f.mjs): one frozen metadata
record shared by every leaf, and a function from the input to the symbols.

- `byte` — the set `[0, 256)`, the byte universe as a range set for `not`;
  `not(s)` — the bytes not in `s`, since the front end's `remove` needs the
  universe named and `unicodeMax` is the wrong one.
- `symbols` — `Meta<Byte>[]` from a `List<number>` of bytes, and from a `Vec`
  through `u8List(msb)`. A `List` rather than a `Vec` alone, because of the
  `Vec` ceiling below.
- **Alphabet validation.** A string in the front end's rule union lowers to
  one terminal per code point. For ASCII a code point is its byte, so
  `'tree '` and `set(' \n')` spell the right bytes and the grammars below
  use them as they are. For anything above `0x7F` the lowering is silently
  wrong: `'é'` becomes the single byte `0xE9`, a rule that matches and means
  nothing. The adapter therefore validates the lowered `RuleSet` before a
  parser is built and refuses any set with a boundary above `256`, EOF's
  `[-1, 0]` excepted — the byte counterpart of what `validate` in
  [`fjs/ebnf/data`](../fjs/ebnf/data/README.md) refuses for every alphabet.
  `byteParser(rule, set)` is `parser` behind that check.

#### 2. `fjs/git/` — the object grammars and their values

A new top-level module: Git is the container the DISOT issues build on, not
a media type of the CAS store, and refs, packs and the object store will
join it. The sketches below are the front end's forms; each grammar ships
with the mappings that fold it to a value and a proof over real objects.

**Values.** An id, a name, an email and a message are bytes:

```ts
type Oid = Vec                                    // 20 or 32 bytes, raw
type ObjectType = 'blob' | 'tree' | 'commit' | 'tag'
type Ident = { name: Vec, email: Vec, time: bigint, tz: string }
type Header = readonly [key: string, value: Vec]  // the key is ASCII
type Commit = {
    tree: Oid, parents: readonly Oid[], author: Ident, committer: Ident,
    headers: readonly Header[],                   // every header, in order
    message: Vec,
}
type TreeEntry = { mode: number, name: Vec, oid: Oid }
type Tag = { object: Oid, type: ObjectType, tag: Vec, tagger: Nullable<Ident>,
    headers: readonly Header[], message: Vec }
```

`headers` keeps every header as read, the well-known ones included, because
the signature work needs the block verbatim to reconstruct a payload, and a
header the reader does not know must survive a read and a write unchanged.

**The envelope.** `objectType` is a variant of four keywords with four
distinct first bytes, so it is LL(1) as written; `size` is
`repeatFrom1(digit)`; the payload is `repeatFrom0(byte)` to `eof`. The
mapping decodes the size and refuses the object when it is not the payload's
length.

**The header block**, shared by commit and tag:

```js
const key = repeatFrom1(not(set(' \n')))
const line = [repeatFrom0(not(set('\n'))), '\n']
const header = [key, ' ', line, repeatFrom0([' ', line])]
const headers = repeatFrom0(header)
const object = [headers, '\n', repeatFrom0(byte), eof]
```

Generic on purpose, the way Git's own reader is: which keys are required,
in what order, and what their values mean are checks on the `Header` list
after the parse, not branches of the grammar. A variant over the known keys
would conflict with the unknown-header branch on every first byte, and would
refuse a commit the moment a tool adds a header — `didsig` and `tstsig`
among them. LL(1) holds throughout: a continuation round starts on SP, and
what may follow the repetition is a key's first byte, which is not SP, or
the empty line's LF; a header starts on a key byte, and what follows the
block is LF.

**Ident** is a second layer over one header's value, the byte-level twin
of the token layer in [`fjs/ebnf/ll1`](../fjs/ebnf/ll1/README.md): a grammar
over the bytes of the value, `[repeatFrom0(not(set('<\n'))), '<',
repeatFrom0(not(set('>\n'))), '>', ' ', digits, ' ', set('+-'),
times(4)(digit)]`, with the name's trailing SP dropped by the mapping. It
is a `try*`: an ident the grammar does not cover — Git's reader is lenient
and old history holds idents without an email or with a malformed zone —
is refused, not repaired, and the raw header stays in `headers` either way.
Which of those forms are worth accepting is decided when one is met, as an
issue naming the object.

**Tree** is `repeatFrom0(entry)` then `eof`, with
`entry = [repeatFrom1(octal), ' ', repeatFrom1(not('\0')), '\0', times(n)(byte)]`
for the repository's id width `n`. The mode set, the entry order Git
requires (by name, a subtree as if its name ended in `/`), and a name
holding `/` are `git fsck`'s checks; they belong in a `validate` over the
entry list, separate from the grammar, so a reader can still read an object
`fsck` would flag.

**Tag** is the header block with `object`, `type`, `tag` and an optional
`tagger`. A `mergetag` header in a commit is a tag object in a value, and
it is read by handing the value's bytes to the tag grammar — one more layer
over the same alphabet.

**The id width** is a parameter of the module — `{ oidBytes: 20n | 32n }` —
because it changes a grammar (`times(n)(byte)` in the tree) and a check (the
hex length in every header that names an object). A hex id of any other
length is refused.

#### 3. What the grammar does not do

These are limits to state, each refused where it is crossed and none
approximated:

- **Inflate.** A loose object is always zlib-compressed and the repository
  has no DEFLATE decoder ([RFC 1950](https://www.rfc-editor.org/rfc/rfc1950),
  [RFC 1951](https://www.rfc-editor.org/rfc/rfc1951)). The parser is pure
  over the inflated bytes whatever supplies them. First, `node:zlib` behind
  an effect in a thin `.mjs` adapter at the host boundary, as
  [AGENTS.md §3](../AGENTS.md#3-functionalscript-and-typescript-fjs) allows;
  a FunctionalScript inflater is its own issue, and running `git cat-file`
  from code is an external tool that needs approval first
  ([AGENTS.md §6](../AGENTS.md#6-external-tools)).
- **SHA-1.** Reading an object needs no hash; addressing or verifying one
  does. [`fjs/crypto/sha2`](../fjs/crypto/sha2/module.f.mjs) covers SHA-256
  repositories; SHA-1 does not exist here and is its own issue, noting that
  Git computes it with collision detection (`sha1dc`), which a verifier may
  or may not want.
- **The `Vec` ceiling.** `maxLength` in `fjs/types/bit_vec` is `2^20` bits,
  128 KiB. A commit or a tag fits; a tree entry is about forty bytes, so a
  tree of more than roughly three thousand entries does not, and a blob may
  not either. That is why `symbols` takes a `List<number>` and a `Vec` is
  what a *field* is, never what an object has to be. Where a field must be a
  `Vec`, it is built with `tryU8ListToVec` and a `null` is refused, never
  truncated ([DESIGN.md §6](../doc/DESIGN.md#6-never-precompute-a-size-to-predict-whether-something-fits)).
- **One `Meta` per byte.** The LL(1) backend takes an array of symbols,
  each an object, and streams nothing (its README, "Left for later"). For
  commits, tags and trees that is fine; it is the reason a blob is never
  handed to a parser.
- **Semantic rules.** Required headers and their order, a duplicated
  `tree`, a hex id of the wrong length, a timestamp out of range, the mode
  set, the entry order: all after the parse, in one `validate` per object
  type, refusing what it cannot vouch for and naming what it refused.
- **Packfiles and `.idx`.** Length-framed throughout — varint sizes, delta
  chains, embedded zlib streams. A decoder in the `fjs/asn.1` style, and a
  later issue; most objects in a real repository live there, so the
  loose-object reader alone reads a fresh clone poorly.
- **Writing.** The inverse — a `Commit` back to bytes, byte-exact, so that a
  signed payload hashes to what Git hashes — is what the signature work
  needs and what the proofs round-trip through. Same module, its own task.

### Tasks

- [ ] `fjs/ebnf/byte/`: `byte`, `not`, `symbols`, alphabet validation,
      `byteParser`; proof.
- [ ] `fjs/git/object/`: the envelope grammar and mapping, size checked.
- [ ] `fjs/git/header/`: the header block, shared by commit and tag.
- [ ] `fjs/git/ident/`: the ident grammar as a `try*` over a header value.
- [ ] `fjs/git/commit/`, `fjs/git/tag/`, `fjs/git/tree/`: grammar, mappings,
      `validate`, and the writer for each, parameterized by the id width.
- [ ] Proofs over real objects: capture a handful with `git cat-file` once
      — a merge commit with `gpgsig` and `mergetag`, a signed tag, a tree
      with every mode, a SHA-256 object — and check them in as byte
      literals; nothing in code calls `git`.
- [ ] Inflate at the boundary: a `.mjs` adapter over `node:zlib` as an
      effect; file the FunctionalScript inflater as its own issue.
- [ ] File SHA-1, packfiles, refs and the object-store walk as their own
      issues, each linking here.

### Related

- [git-name-resolution](./git-name-resolution.md) — the first consumer: the
  root entries of a commit's tree, and one blob under it.
- [git-trusted-timestamp-signatures](./git-trusted-timestamp-signatures.md)
  — every header verbatim, and the writer.
- [ebnf-migration](../fjs/todo/ebnf-migration.md) — reserves
  `fjs/ebnf/byte/` for the first consumer that wants it.
- [unicode-rules](../fjs/bnf/todo/unicode-rules.md) — the byte adapter's
  first design, as the half of that issue the text half left behind.
- [layered-parser](../fjs/bnf/todo/layered-parser.md) — bytes as the bottom
  alphabet of the pipeline; ident and `mergetag` are layers over it.
- [`fjs/ebnf/ll1/README.md`](../fjs/ebnf/ll1/README.md) — the backend, its
  conflicts, and the rewrite set the mappings are written against.
- [`fjs/asn.1`](../fjs/asn.1/module.f.mjs) — the length-framed precedent, the
  shape a packfile decoder takes.
- [`fjs/media/type`](../fjs/media/type/module.f.mjs) — reads bytes out of a
  `Vec` through `u8List(msb)`, as `symbols` will.
- [`fjs/media/json/parser`](../fjs/media/json/parser/module.f.mjs) — a whole
  grammar folded to a value by its rewrite set, with a `Result` in the
  output symbol for what a mapping refuses.
