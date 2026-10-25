## Share demo inputs through URL fragments

**Priority:** P3
**Status:** wip — URL restoration and copying

### Problem

Readers cannot share a demo with a selected example or custom inputs restored.
New demos need a shared contract for restoring inputs and a "Copy demo link"
button, including demos with several inputs.

### Proposal

Use the page path to identify the demo and a namespaced fragment to describe
its inputs, open the Demo section, and scroll to it:

```text
https://functionalscript.com/fjs/compiler/#demo:example=hex-escape
/fjs/compiler/#demo:state=BASE64URL_JSON
```

`example` identifies a predefined example by a stable ID, separate from its
display label and never its dropdown index. For example, `hex-escape` selects
**Hex escape**, loads its source into the compiler editor, and recalculates
the ordinary live outputs. Reordering examples or changing a display label
must not break a saved link. Shared compiler-stage examples use the same IDs
on each stage's page. Define how retired IDs are handled.
Each predefined example restores the complete input set it represents,
including selecting the corresponding entry in the example dropdown.

Recognize only the `#demo:` namespace as encoded demo inputs. Existing README
heading fragments, such as `/fjs/compiler/#ast`, keep their normal meaning;
README heading text does not need to change. Plain `#demo` still opens the
demo with its default inputs. Handle initial load, `hashchange`, and browser
back/forward navigation through the same restoration path.

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
crashing or applying a partial state. Specify handling for repeated fragment
parameters and edits made while the runtime is loading.

Every new demo must support restoring its shareable inputs and expose a
"Copy demo link" button through shared demo infrastructure. Copy chooses an
example link only when the entire input set matches that example; otherwise
it encodes custom state. The dropdown continues to derive its selection from
the input where it does today. Use the existing clipboard helper and report
copy success or failure. Copying does not change the address bar while typing.
Keep the page origin and path and write the selected example ID or encoded
state inside `#demo:`. Do not duplicate demo inputs in query parameters.

Loading a link restores inputs and computes ordinary live outputs. It must
not press Run, start expensive work normally gated behind a button, or replay
other action buttons. A demo with no shareable inputs copies its `#demo` URL.

Base64 is reversible, not private storage, and increases URL length. Establish
an encoded-size limit and show a clear message when input is too large to
share; do not silently truncate it. Backend storage and URL shortening are
outside this proposal.

### Implementation steps

The stable-ID step uses explicit `[label, source, id]` text examples,
`[label, keys, key, hint, id]` tree presets, and RTTI lesson `id` properties.
Dropdown values and demo events continue to use their existing labels.
ID lookup returns `null` for unknown or retired IDs; the restoration step
must report that refusal. IDs are retained across renames and reordering,
and retired IDs are never reused. See the
[authoring contract](../README.md#stable-example-ids).

The next step adds encoding, atomic restoration and Copy demo link; this
stable-ID step does not enable fragment input restoration by itself.

### Tasks

- [x] Add stable example IDs separate from labels, including `hex-escape` for
      Hex escape; document ID stability and retired-ID handling.
- [ ] Specify and document the `#demo:` grammar, the versioned state schema,
      control value encodings, validation, defaults, precedence, repeated
      parameters, startup edits, and the sharing size limit.
- [ ] Add shared encoding/decoding and a demo API for exporting and restoring
      complete input sets, with the impure URL and clipboard work in the
      browser runtime. Keep demo update/view logic independent of browser APIs.
- [ ] Add the shared "Copy demo link" button and clear feedback, including
      malformed links, unavailable clipboard access, and oversized input.
- [ ] Integrate with [section fragments](../../README.md#section-links) so a
      shared link reveals Demo and scrolls after restoration.
- [ ] Migrate existing demos, including text demos and demos with several
      controls; retain explicit Run actions where required.
- [ ] Update [`../README.md`](../README.md) and the demo authoring contract in
      [`../../README.md`](../../README.md) and [`../types.ts`](../types.ts):
      require every new demo to support fragment restoration and the shared
      "Copy demo link" button; explain how to declare stable input names,
      defaults and examples, with single-input and multiple-input examples.
- [ ] Cover round trips, Unicode, empty and unchecked values, multiple
      controls, example matching, validation failures and size limits with
      focused proofs. Browser-check copy/open, correct dropdown selection,
      atomic restoration, and preservation of explicit Run behavior. Verify the
      Hex escape link, reordered/renamed examples, shared compiler-stage IDs,
      hash changes, history navigation, and unaffected README heading links.

### Related

- [Section links](../../README.md#section-links)
  — supplies the Demo target and navigation behavior.
- [`examplePicker`](../examples/module.f.js) — derives example selection
  from source text rather than storing a second selection value.
- [`textDemo`](../module.f.mjs) — shared text demo controls and update flow.
- [`demo-runtime.mjs`](../../demo-runtime.mjs) — browser event and effect
  boundary where restoration must coordinate with startup edits.
