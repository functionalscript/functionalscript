## Git trusted timestamp signatures

**Priority:** P3
**Status:** open

### Problem

Git commit signatures authenticate a commit, but Git has no standard commit-header
mechanism for a trusted timestamp authority (TSA) to attest when the signed
payload existed. The `author` and `committer` timestamps are assertions made by
the commit creator; they are not trusted time.

We want a format that:

- remains an ordinary Git `commit` object, without auxiliary attestation commits;
- lets current Git versions still verify a normal `gpgsig`;
- lets newer/specialized clients verify DID signatures and RFC 3161 trusted
  timestamps;
- lets the trusted timestamp cover the DID signatures themselves, not only the
  underlying commit fields;
- supports multiple independent DID signers and multiple independent TSAs;
- naturally timestamps merge commits, so one timestamp can anchor several
  parent histories, including histories whose earlier commits were unsigned.

Git already has precedent for defining more than one signature-related commit
header: the SHA-256 transition defines `gpgsig-sha256` alongside `gpgsig`, with
explicit rules for reconstructing the signed payload. See
[gitformat-signature](https://git-scm.com/docs/gitformat-signature) and
[hash-function-transition](https://git-scm.com/docs/hash-function-transition.html).
RFC 3161 defines a `TimeStampToken` whose signed `TSTInfo` contains the
`messageImprint` and TSA-generated `genTime`; see
[RFC 3161](https://www.rfc-editor.org/rfc/rfc3161.html).

### Proposal

Prototype two new repeatable commit headers:

- `gpgsig2` — a DID-addressed author/attestor signature;
- `tstsig` — an RFC 3161 trusted timestamp token.

The names are provisional. The important part is the payload projection defined
for each signature class.

#### 1. Base payload

Let `A` be the complete commit payload before any signature headers are added:

```text
tree <tree>
parent <parent-1>
parent <parent-2>
author ...
committer ...

<message>
```

`A` MUST contain no `gpgsig`, `gpgsig-sha256`, `gpgsig2`, or `tstsig` headers.
A tool asked to create this form from an already signed/attested commit MUST
reject it rather than silently remove signatures: removing an existing
`gpgsig` changes the object being attested to, while adding ordinary fields to
an already-`gpgsig`-signed commit breaks normal Git signature verification.

All ordinary commit fields, parents, and the message are frozen once signing
starts.

#### 2. DID signatures (`gpgsig2`)

Create zero or more independent DID signatures over the same canonical `A`:

```text
S1 = DIDSign(did1, Hash(A))
S2 = DIDSign(did2, Hash(A))
...
```

Form `B` by adding every `gpgsig2` header to `A`:

```text
B = A + gpgsig2(S1) + gpgsig2(S2) + ...
```

All `gpgsig2` signatures therefore refer to the same base payload; they do not
form a signature chain. The exact digest algorithm, domain separation, DID/key
identification, signature algorithm identification, and textual encoding need
to be specified by the prototype.

Once trusted timestamping starts, `gpgsig2` headers MUST NOT be added, removed,
or changed.

#### 3. Trusted timestamps (`tstsig`)

Timestamp `B`, including all `gpgsig2` headers:

```text
H = Hash(B)
T1 = RFC3161(TSA1, H)
T2 = RFC3161(TSA2, H)
...
```

RFC 3161 sends the digest as the request `messageImprint`; the TSA supplies the
trusted `genTime` from its own clock and signs the resulting `TSTInfo` inside
the returned `TimeStampToken`.

Form `C` by adding zero or more independent `tstsig` headers:

```text
C = B + tstsig(T1) + tstsig(T2) + ...
```

Every `tstsig` MUST timestamp exactly the same `B`. Multiple TSA tokens are
parallel witnesses, not a chain: TSA2 does not timestamp TSA1's token. This also
means an additional TSA token may be added later while no standard `gpgsig` has
yet been added, because all `tstsig` fields are excluded when reconstructing
`B`.

The prototype must define a deterministic text encoding for the binary RFC 3161
response, for example base64 DER using Git-style multiline header continuation
lines.

#### 4. Existing Git signature (`gpgsig`)

After all `gpgsig2` and `tstsig` headers are final, optionally add a normal Git
signature using existing Git semantics:

```text
G = GitSign(C)
D = C + gpgsig(G)
```

This step is deliberately last. Current Git removes the recognized `gpgsig`
header when reconstructing its signed payload, so it verifies `G` against `C`,
which still contains the unknown `gpgsig2` and `tstsig` headers exactly as they
were when `G` was produced.

For the initial compatibility experiment, use the standard signature shapes Git
already supports (`gpgsig`, and `gpgsig-sha256` where applicable). Do not depend
on arbitrary repeated `gpgsig` headers; current Git does not define them as a
general multi-signature facility.

### Verification projections

A specialized verifier reconstructs three different payloads from the final
commit.

For every `gpgsig2`:

```text
remove all standard Git signature headers
remove all tstsig headers
remove all gpgsig2 headers
=> A
```

Verify every `gpgsig2` against `Hash(A)` and its DID/key.

For every `tstsig`:

```text
remove all standard Git signature headers
remove all tstsig headers
KEEP all gpgsig2 headers
=> B
```

Verify the RFC 3161 token and require its `messageImprint` to equal `Hash(B)`.
The verified token's `genTime` is the trusted time. Each TSA is evaluated
independently according to the user's trust policy.

For existing Git signatures:

```text
use Git's existing gpgsig / gpgsig-sha256 projection
=> C
```

Current Git should therefore continue to verify the ordinary Git signature,
while an aware client can additionally show DID signers and trusted timestamps.

The resulting chronology is:

```text
A: commit payload
    |
    +-- zero or more DID signatures
    v
B: A + gpgsig2*
    |
    +-- zero or more independent RFC 3161 timestamps
    v
C: B + tstsig*
    |
    +-- optional current-Git signature
    v
D: final Git commit
```

The assertions are intentionally different:

- `gpgsig2`: DID X signed `A`;
- `tstsig`: `B`, including all listed DID signatures, existed no later than the
  token's trusted `genTime`;
- `gpgsig`: the conventional Git signer signed `C`, including all DID
  signatures and trusted timestamp tokens.

The final `gpgsig` is not claimed to have existed at the trusted time; it may be
added afterward.

### Merge commits and history anchoring

A merge commit may have multiple parents:

```text
parent <A>
parent <B>
parent <C>
```

Those parent object IDs are part of the payload covered by `gpgsig2` and
`tstsig`. A single trusted timestamp on such a merge therefore anchors all of
its parents, and recursively the histories named by those parents, under the
usual hash-security assumptions.

This does not retroactively make an unsigned parent "signed by" the merge
signer. An aware client should distinguish direct signatures from anchoring, for
example: an older commit may have no direct author signature but be anchored by
a later signed and trusted-timestamped merge commit.

### Tool prototype

Build a small tool that can create and verify these commits without first
patching Git itself.

Creation should:

- [ ] parse a prospective commit payload and reject pre-existing `gpgsig`,
  `gpgsig-sha256`, `gpgsig2`, or `tstsig` when starting a new attested commit;
- [ ] produce zero or more `gpgsig2` values over exactly `A` using DID keys;
- [ ] produce one or more RFC 3161 requests over exactly `B` and embed the
  returned tokens as repeatable `tstsig` headers;
- [ ] optionally add an ordinary Git `gpgsig` last;
- [ ] write the final object as a standard Git `commit` object and update a ref.

Verification should report each layer separately:

```text
DID signatures:
  did:...   valid
  did:...   valid

Trusted timestamps:
  TSA A     valid   <genTime>
  TSA B     valid   <genTime>

Git signature:
  valid
```

Compatibility tests should cover:

- [ ] `git cat-file -p`, `git show`, `git log`, `git fsck`, clone/fetch/push, and
  garbage collection with `gpgsig2`/`tstsig` present;
- [ ] `git verify-commit` on a final commit whose ordinary `gpgsig` was added
  after `tstsig`;
- [ ] zero, one, and multiple `gpgsig2` values;
- [ ] one and multiple `tstsig` values from different TSAs, all verifying the
  same reconstructed `B`;
- [ ] merge commits with multiple parents, including previously unsigned parent
  histories;
- [ ] SHA-1 and SHA-256 repositories, including the existing
  `gpgsig-sha256` transition rules;
- [ ] malformed/duplicate/unsupported signature encodings and rejection rules;
- [ ] attempting to add `gpgsig2` or `tstsig` after an ordinary `gpgsig` has
  already sealed the commit.

If the prototype demonstrates stable interoperability, prepare an upstream Git
RFC proposing the header names, canonical payload projections, encodings, and
verification/UI behavior.

### Related

- [DISOT vision](./plan/vision.md) — signatures and trusted timestamps are core
  provenance primitives.
- [DISOT roadmap](./plan/roadmap.md) — includes Git-like commit blocks and
  signed content.
- [Git cryptographic signature formats](https://git-scm.com/docs/gitformat-signature)
  — existing `gpgsig` semantics.
- [Git hash-function transition](https://git-scm.com/docs/hash-function-transition.html)
  — `gpgsig-sha256` precedent and payload-projection rules.
- [RFC 3161](https://www.rfc-editor.org/rfc/rfc3161.html) — trusted timestamp
  request/response and `TimeStampToken` semantics.
