## Share demo inputs through URL queries

**Priority:** P3
**Status:** open

### Problem

Readers cannot share a demo with a selected example or custom inputs restored.
New demos need a shared contract for restoring inputs and a "Copy demo link"
button, including demos with several inputs.

### Proposal

Use the page path to identify the demo, query parameters to describe its
inputs, and `#demo` to open and scroll to it:

```text
/fjs/compiler/?example=Overview#demo
/fjs/compiler/?state=BASE64URL_JSON#demo
```

`example` identifies a predefined example by a stable name, never its dropdown
index. The existing picker uses names; define whether these remain the link
identifiers or need separate IDs before allowing display-name changes.
Each predefined example restores the complete input set it represents.

`state` is JSON encoded as UTF-8 and then unpadded Base64url. Use the same
format for single-input and multiple-input demos. A proposed payload is:

```json
{
  "v": 1,
  "inputs": {
    "message": "Hello 🌍",
    "algorithm": "sha256",
    "iterations": "100"
  }
}
```

Keys match stable control `name` values. Define encodings for text,
dropdowns, radio groups and checkboxes in one shared contract, including
unchecked and empty values. Share only the inputs needed to reproduce the
demo; derive outputs again, without serializing DOM state or in-flight work.

When both parameters exist, `state` takes precedence. Validate the payload
and the demo's supported fields before restoring all values together, so
intermediate calculations never see a partially restored form. Missing fields
use documented defaults. Report unknown examples, malformed encoding,
unsupported versions, unknown fields, or invalid values clearly without
crashing or applying a partial state. Specify handling for repeated query
parameters and edits made while the runtime is loading.

Every new demo must support restoring its shareable inputs and expose a
"Copy demo link" button through shared demo infrastructure. Copy chooses an
example link only when the entire input set matches that example; otherwise
it encodes custom state. The dropdown continues to derive its selection from
the input where it does today. Use the existing clipboard helper and report
copy success or failure. Copying does not change the address bar while typing.
Keep the page origin and path and set the fragment to `#demo`; include only
the demo query parameters in the generated link.

Loading a link restores inputs and computes ordinary live outputs. It must
not press Run, start expensive work normally gated behind a button, or replay
other action buttons. A demo with no shareable inputs copies its `#demo` URL.

Base64 is reversible, not private storage, and increases URL length. Establish
an encoded-size limit and show a clear message when input is too large to
share; do not silently truncate it. Backend storage and URL shortening are
outside this proposal.

### Tasks

- [ ] Specify and document example identifiers, the versioned state schema,
      control value encodings, validation, defaults, precedence, repeated
      parameters, startup edits, and the sharing size limit.
- [ ] Add shared encoding/decoding and a demo API for exporting and restoring
      complete input sets, with the impure URL and clipboard work in the
      browser runtime. Keep demo update/view logic independent of browser APIs.
- [ ] Add the shared "Copy demo link" button and clear feedback, including
      malformed links, unavailable clipboard access, and oversized input.
- [ ] Integrate with [section fragments](../../todo/url-fragments.md) so a
      shared link reveals Demo and scrolls after restoration.
- [ ] Migrate existing demos, including text demos and demos with several
      controls; retain explicit Run actions where required.
- [ ] Update [`../README.md`](../README.md) and the demo authoring contract in
      [`../../README.md`](../../README.md) and [`../types.ts`](../types.ts):
      require every new demo to support query restoration and the shared
      "Copy demo link" button; explain how to declare stable input names,
      defaults and examples, with single-input and multiple-input examples.
- [ ] Cover round trips, Unicode, empty and unchecked values, multiple
      controls, example matching, validation failures and size limits with
      focused proofs. Browser-check copy/open, correct dropdown selection,
      atomic restoration, and preservation of explicit Run behavior.

### Related

- [Link to page sections with URL fragments](../../todo/url-fragments.md)
  — supplies the Demo target and navigation behavior.
- [`examplePicker`](../examples/module.f.js) — derives example selection
  from source text rather than storing a second selection value.
- [`textDemo`](../module.f.mjs) — shared text demo controls and update flow.
- [`demo-runtime.mjs`](../../demo-runtime.mjs) — browser event and effect
  boundary where restoration must coordinate with startup edits.
