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

- `vnd.fjs.gpgsig` — a DID-addressed author/attestor signature;
- `vnd.fjs.ttssig` — an RFC 3161 `TimeStampToken`.

The `vnd.fjs.*` prefix follows FunctionalScript's existing vendor-style dialect
namespace and makes these explicitly FJS-defined extensions rather than Git
standard headers. `vnd.fjs.gpgsig` deliberately does **not** begin with
`gpgsig`: current Git's signed-payload reconstruction treats `gpgsig*` headers as
signature material, so a name such as `gpgsig2` would be excluded from the
payload covered by a later ordinary `gpgsig`.

`tts` means **Trusted Time-Stamp**. The doubled `t` in `ttssig` is intentional;
`tstsig` is avoided because it visually reads as "test signature".

The important part is the payload projection defined for each signature class.

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

`A` MUST contain no `gpgsig`, `gpgsig-sha256`, `vnd.fjs.gpgsig`, or
`vnd.fjs.ttssig` headers. A tool asked to create this form from an already
signed/attested commit MUST reject it rather than silently remove signatures:
removing an existing `gpgsig` changes the object being attested to, while adding
ordinary fields to an already-`gpgsig`-signed commit breaks normal Git signature
verification.

All ordinary commit fields, parents, and the message are frozen once signing
starts.

#### 2. DID signatures (`vnd.fjs.gpgsig`)

Create zero or more independent DID signatures over the same canonical `A`:

```text
S1 = DIDSign(did1, key1, Hash(A))
S2 = DIDSign(did2, key2, Hash(A))
...
```

Form `B` by adding every `vnd.fjs.gpgsig` header to `A`:

```text
B = A + vnd.fjs.gpgsig(S1) + vnd.fjs.gpgsig(S2) + ...
```

All `vnd.fjs.gpgsig` signatures therefore refer to the same base payload; they
do not form a signature chain. Each value must bind at least:

- the DID;
- the verification-method/key identifier;
- immutable public-key material or a cryptographic fingerprint sufficient to
  verify the signature independently of later DID resolution;
- digest/signature algorithm identifiers;
- the signature.

The exact digest algorithm, domain separation, and textual encoding need to be
specified by the prototype.

A cryptographically valid signature by key `K` is not automatically proof that
`K` represented DID `D` at the trusted timestamp. DID documents may rotate or
recover keys. To report a historical claim such as "`D` signed `A` before time
T", verification MUST also establish that `K` was authorized for `D` at the
relevant trusted-time bound. Acceptable approaches include:

- a DID method with immutable key binding;
- historical/versioned DID resolution proving the key was authorized at that
  time;
- another immutable authorization proof bound into the attestation.

If the DID method cannot establish contemporaneous authorization, the verifier
may report the key signature itself but MUST NOT present it as a historically
verified DID identity.

Once trusted timestamping starts, `vnd.fjs.gpgsig` headers MUST NOT be added,
removed, or changed.

#### 3. Trusted timestamps (`vnd.fjs.ttssig`)

Timestamp `B`, including all `vnd.fjs.gpgsig` headers:

```text
H = Hash(B)
T1 = RFC3161(TSA1, H)
T2 = RFC3161(TSA2, H)
...
```

RFC 3161 sends `H` as the request `messageImprint`. The TSA supplies `genTime`
from its own clock and signs the resulting `TSTInfo` inside a `TimeStampToken`.

An RFC 3161 `TimeStampResp` is only the protocol response wrapper. On successful
status, the prototype MUST extract its `timeStampToken` and store exactly that
`TimeStampToken` in `vnd.fjs.ttssig`, not the surrounding `TimeStampResp`.

Form `C` by adding zero or more independent `vnd.fjs.ttssig` headers:

```text
C = B + vnd.fjs.ttssig(T1) + vnd.fjs.ttssig(T2) + ...
```

Every `vnd.fjs.ttssig` MUST timestamp exactly the same `B`. Multiple TSA tokens
are parallel witnesses, not a chain: TSA2 does not timestamp TSA1's token. This
also means an additional TSA token may be added later while no standard
`gpgsig` has yet been added, because all `vnd.fjs.ttssig` fields are excluded
when reconstructing `B`.

The prototype must define a deterministic text encoding for the binary
`TimeStampToken`, for example base64 of its DER encoding using Git-style
multiline header continuation lines.

RFC 3161 time is not always an exact point. If the token (or the applicable TSA
policy) establishes an accuracy `a`, the actual TSA time is bounded by
`genTime ± a`. A verifier therefore MUST NOT claim that `B` existed no later
than raw `genTime`; the conservative trusted upper bound is `genTime + a`.
If no usable accuracy bound can be established, the verifier should expose
`genTime` but MUST avoid claiming finer ordering precision than the TSA policy
supports.

#### 4. Existing Git signature (`gpgsig`)

After all `vnd.fjs.gpgsig` and `vnd.fjs.ttssig` headers are final, optionally
add a normal Git signature using existing Git semantics:

```text
G = GitSign(C)
D = C + gpgsig(G)
```

This step is deliberately last. Current Git removes the recognized `gpgsig`
header when reconstructing its signed payload, while the non-colliding
`vnd.fjs.gpgsig` and `vnd.fjs.ttssig` headers remain. It therefore verifies `G`
against `C`, covering the DID signatures and timestamp tokens exactly as they
were when `G` was produced.

For the initial compatibility experiment, use the standard signature shapes Git
already supports (`gpgsig`, and `gpgsig-sha256` where applicable). Do not depend
on arbitrary repeated `gpgsig` headers; current Git does not define them as a
general multi-signature facility.

### Verification projections

A specialized verifier reconstructs three different payloads from the final
commit.

For every `vnd.fjs.gpgsig`:

```text
remove all standard Git signature headers
remove all vnd.fjs.ttssig headers
remove all vnd.fjs.gpgsig headers
=> A
```

Verify every `vnd.fjs.gpgsig` cryptographically against `Hash(A)` and its bound
key. Separately verify the DID-to-key authorization at the relevant trusted-time
bound before reporting a historical DID identity.

For every `vnd.fjs.ttssig`:

```text
remove all standard Git signature headers
remove all vnd.fjs.ttssig headers
KEEP all vnd.fjs.gpgsig headers
=> B
```

Verify the RFC 3161 `TimeStampToken` and require its `messageImprint` to equal
`Hash(B)`. Report `genTime` together with the established accuracy. When an
accuracy bound `a` exists, use `genTime + a` as the conservative "existed no
later than" bound. Each TSA is evaluated independently according to the user's
trust policy.

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
B: A + vnd.fjs.gpgsig*
    |
    +-- zero or more independent RFC 3161 timestamps
    v
C: B + vnd.fjs.ttssig*
    |
    +-- optional current-Git signature
    v
D: final Git commit
```

The assertions are intentionally different:

- `vnd.fjs.gpgsig`: key K signed `A`; DID attribution additionally requires
  historical authorization of K for that DID;
- `vnd.fjs.ttssig`: `B`, including all listed DID signatures, existed by the
  token/policy's trusted upper time bound;
- `gpgsig`: the conventional Git signer signed `C`, including all DID signatures
  and trusted timestamp tokens.

The final `gpgsig` is not claimed to have existed at the trusted time; it may be
added afterward.

### Merge commits and history anchoring

A merge commit may have multiple parents:

```text
parent <A>
parent <B>
parent <C>
```

Those parent object IDs are part of the payload covered by `vnd.fjs.gpgsig` and
`vnd.fjs.ttssig`. A single trusted timestamp on such a merge therefore anchors
all of its parents, and recursively the histories named by those parents, under
the usual hash-security assumptions.

This does not retroactively make an unsigned parent "signed by" the merge
signer. An aware client should distinguish direct signatures from anchoring, for
example: an older commit may have no direct author signature but be anchored by
a later signed and trusted-timestamped merge commit.

### Tool prototype

Build a small tool that can create and verify these commits without first
patching Git itself.

Creation should:

- [ ] parse a prospective commit payload and reject pre-existing `gpgsig`,
  `gpgsig-sha256`, `vnd.fjs.gpgsig`, or `vnd.fjs.ttssig` when starting a new
  attested commit;
- [ ] produce zero or more `vnd.fjs.gpgsig` values over exactly `A`, binding the
  DID and immutable verification key/fingerprint;
- [ ] produce one or more RFC 3161 requests over exactly `B`, accept only a
  successful response, extract its `TimeStampToken`, and embed that token as a
  repeatable `vnd.fjs.ttssig` header;
- [ ] optionally add an ordinary Git `gpgsig` last;
- [ ] write the final object as a standard Git `commit` object and update a ref.

Verification should report each layer separately, for example:

```text
DID signatures:
  did:...   signature valid; historical authorization valid
  did:...   signature valid; historical authorization unavailable

Trusted timestamps:
  TSA A     valid   genTime=<...>  accuracy=<...>  upper-bound=<...>
  TSA B     valid   genTime=<...>  accuracy=<...>  upper-bound=<...>

Git signature:
  valid
```

Compatibility tests should cover:

- [ ] `git cat-file -p`, `git show`, `git log`, `git fsck`, clone/fetch/push, and
  garbage collection with `vnd.fjs.gpgsig`/`vnd.fjs.ttssig` present;
- [ ] capture the exact payload stock Git passes to its verifier and confirm
  `vnd.fjs.gpgsig` and `vnd.fjs.ttssig` remain covered by a later ordinary
  `gpgsig`;
- [ ] `git verify-commit` on a final commit whose ordinary `gpgsig` was added
  after `vnd.fjs.ttssig`;
- [ ] zero, one, and multiple `vnd.fjs.gpgsig` values;
- [ ] DID key rotation/recovery cases, including rejection or downgraded identity
  status when historical authorization cannot be established;
- [ ] one and multiple `vnd.fjs.ttssig` values from different TSAs, all
  verifying the same reconstructed `B`;
- [ ] RFC 3161 responses with success/failure status, absent token, and tokens
  with/without explicit accuracy;
- [ ] merge commits with multiple parents, including previously unsigned parent
  histories;
- [ ] SHA-1 and SHA-256 repositories, including the existing
  `gpgsig-sha256` transition rules;
- [ ] malformed/duplicate/unsupported signature encodings and rejection rules;
- [ ] attempting to add `vnd.fjs.gpgsig` or `vnd.fjs.ttssig` after an ordinary
  `gpgsig` has already sealed the commit.

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
