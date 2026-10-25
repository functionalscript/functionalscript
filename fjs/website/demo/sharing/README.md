# Shareable demo inputs

A demo link identifies a module by its page path and restores a complete input
set through the fragment. The shared runtime owns navigation, clipboard access,
and feedback; demo code remains pure. A restore validates everything first and
constructs one state, without replaying input events or action buttons.

## Fragments

- `#demo` restores the declared defaults and reveals the Demo section.
- `#demo:example=hex-escape` restores the complete example identified by a
  stable ID, including the picker selection. Unknown or retired IDs are errors.
- `#demo:state=BASE64URL_JSON` restores custom inputs.
- With both `state` and `example`, state wins after parameter validation.

Parameter names are case-sensitive. Values use UTF-8 percent escapes; `+`
is a literal plus, not a space. Unknown parameters, invalid escapes, missing
`=`, empty examples, and repeated parameter names are refused. Uniqueness is
checked after decoding names. Documentation fragments retain their ordinary
meaning and never restore demo inputs.

The state is JSON encoded as UTF-8, then standard unpadded Base64url (`-` and
`_`, without `=`). Malformed Base64url, invalid UTF-8, invalid JSON, unsupported
versions and unexpected schema properties are refused. The v1 schema is:

```json
{"v":1,"inputs":{"message":"Hello 🌍","algorithm":"sha256","animate":false}}
```

The limit is **16,384 ASCII characters for the encoded fragment**, including
`#demo:` and the parameter names. Incoming links exceeding the limit are
refused before decoding. Oversized outgoing values produce a message instead
of a truncated link or a clipboard write. Base64url is reversible, so inputs
in a link are visible to anyone receiving it. There is no backend storage.

## Input values and validation

A demo declares stable input names, defaults, and allowed choices. Text,
textareas, ranges, selects and radio groups use strings; an empty string is
preserved. Checkboxes use booleans, so unchecked and checked values remain
unambiguous. Button selections, such as RTTI's schema choice, may declare an
input name of their own. Keys describe semantic inputs; the scoped DOM IDs
and scoped native radio names never enter a link.

Only declared fields are admitted. Each value must have the same type as its
default and, when choices are declared, match a choice. Missing fields use the
same declared defaults regardless of the other supplied values. A demo can
also validate relationships between fields, such as selecting the second
schema of an RTTI lesson that only has one. Any error leaves the current
inputs and outputs intact and is reported beneath the Demo heading.

An example supplies all the inputs it changes; declared defaults supply the
rest. The copy-link icon beside Demo copies `#demo` when all inputs equal
their declared defaults, including when those defaults match an example.
Changed inputs use an example link when the entire normalized input set
matches that example; otherwise they export all declared inputs as v1 state.
A demo with no inputs also copies its plain `#demo` URL. Copy preserves the page's
origin and path, omits query parameters, and never changes the address bar.
Typing does not change the URL either.

## Authoring

Every new demo with editable inputs must declare `sharing`. Omission means
there are no shareable inputs and is only appropriate for a demo with no
editable controls. `textDemo` supplies its contract automatically:

```js
const demo = textDemo({
    intro: 'Reads a source program.', name: 'source', label: 'Source',
    init: 'export default 1;',
    examples: [['One', 'export default 1;', 'one']],
})(source => [['pre', source])
```

`withInputs` adapts a flat state whose selected fields are strings or
booleans. Initial values become defaults; everything else is reset to init
when restoring. Declare every select or radio's allowed values explicitly:

```js
const demo = withInputs(definition, ['message', 'algorithm', 'animate'], {
    algorithm: ['sha256', 'sha512'],
})
```

For more complex state, provide a `Sharing<State>` value:

- `fields`: defaults and optional `choices` for all shareable inputs;
- `examples`: stable IDs and input sets;
- `read(state)`: the current semantic input set;
- optional `validate(inputs)`: a message for incompatible fields, or `null`;
- `restore(inputs)`: constructs one state from the complete validated set.

`recordSharing` supports a mapping when a control name differs from its state
key. Nested state, tree presets and RTTI lessons use explicit adapters. Keep
outputs, timings, packets, generated keys, action history and in-flight work
out of `read`. Restore must reset those to their initial values. In particular,
signing shares Alice's and nonce-reuse inputs, not Send/Forward packet history;
tree links share preset/input choices, not subsequent insertions or moves.
A custom tree produced by actions resets to an empty tree with its typed key
and count; use an example link to reconstruct a preset's starting version.

Restore is a pure state constructor. Normal `start` initialization runs with
the complete inputs, just as it does on an ordinary page load; this may load
static resources or initialize a game. It must not start work that normally
requires Run, Measure, Generate, Send, Forward, Verify or another action.
The existing action buttons remain explicit.

## Navigation and startup edits

Initial load, `hashchange`, and browser back/forward use the same decoder and
validator. After restoration, the runtime opens the Demo section and scrolls
to it again, allowing for the restored view's layout. Other fragments leave
the current demo state alone. Additional embedded instances may copy their
inputs to the page's primary Demo target; only that target consumes navigation.

A small head script records input events before the demo's module graph has
loaded. Existing native edits are also checked at takeover. If there were
startup edits, the runtime preserves them, reports that the link was not
applied, and continues the ordinary startup edit flow. Explicit later hash
navigation can still restore a link. Edits made after restoration was queued
cancel it before the replacement is committed, preserving the reader's work.

Copy is refused while input updates are pending, so it never silently copies
an older state. Clipboard success, failure and unavailability use the shared
clipboard helper. The controls remain hidden without JavaScript.
