# Shareable demo inputs

A demo link identifies a module by its page path and restores a complete input
set through individual query parameters. The shared runtime owns navigation, clipboard access,
and feedback; demo code remains pure. A restore validates everything first and
constructs one state, without replaying input events or action buttons.

## Query parameters

- `#demo` reveals Demo and restores defaults when there is no input query.
- `?example=hex-escape#demo` restores a complete named example, including the
  picker selection. Unknown or retired IDs are refused.
- `?compiler=export%20default%20%2241%22%3B#demo` shares a custom compiler source.
- Each custom input has its own parameter. Strings and finite numbers use plain
  values with normal UTF-8 URL escaping; checkboxes use `true` or `false`.
  There is no Base64 wrapper or serialized state object.

Parameter names are stable and case-sensitive. A `+` means space; `%2B` means a
literal plus. Empty strings remain `name=`. Unknown names, malformed escaping,
missing `=`, empty names and repeated names (after decoding) are refused.
Each value is converted according to its declared default's type. Numeric form
controls currently declare string defaults, preserving typed values such as
leading zeros and incomplete expressions. Number-valued adapters accept finite
JSON numbers. A demo may validate relationships between fields before any
state is replaced. An invalid link preserves current inputs and outputs.

A named example supplies a complete baseline; explicit input parameters override
it. Missing values otherwise use declared defaults. A declared input named
`example`, used by RTTI and tree demos, is still validated as an ordinary input:
a known example ID selects the preset, while an allowed custom selection such
as an empty tree ID remains valid. No declared input is silently discarded.

Copy uses `#demo` for defaults and `?example=ID#demo` for a complete example
match. Other inputs are exported in sorted parameter-name order as a complete
input set. Outputs, action history and generated results are excluded. Copied
links preserve origin/path and replace the old query; typing and copying never
change the address bar.

The limit is **16,384 ASCII characters for the encoded query plus `#demo`**,
including `?` and parameter names. Oversized incoming queries are refused before
decoding; oversized outgoing values produce feedback rather than truncation.
Query values are readable in the link and are sent to the server with the page
request. No backend storage is added.

Documentation fragments retain their normal meaning. For example,
`?compiler=export%20default%201%3B#syntax` can restore inputs and navigate to
Syntax independently. Changing only the heading fragment preserves current
edits. Browser back/forward restores changed queries, and removing a query
restores defaults.

## Copy controls

The plain chain beside Demo, **Copy section link**, copies the section target
without input parameters, including while inputs update or exceed the sharing
limit. The chain labeled **Copy with inputs** copies the current inputs using
the query contract above. Its accessible name matches the visible label, and
this action is disabled for demos without inputs. Each button has its own
clipboard feedback, visible even with Demo folded. Without JavaScript, the
native section anchor remains available.

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

`withInputs` adapts a flat state whose selected fields are strings, finite numbers or
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

Initial load and query changes on browser back/forward use the same decoder
and validator. After restoration, the runtime reveals the actual fragment
target again, allowing for the restored view's layout. Heading-only navigation
leaves current demo state alone. Additional embedded instances may copy their
inputs to the page's primary Demo target; only that target consumes navigation.

A small head script records input events before the demo's module graph has
loaded. Existing native edits are also checked at takeover. If there were
startup edits, the runtime preserves them, reports that the link was not
applied, and continues the ordinary startup edit flow. Explicit later query
navigation can still restore a link. Edits made after restoration was queued
cancel it before the replacement is committed, preserving the reader's work.

Copy is refused while input updates are pending, so it never silently copies
an older state. Clipboard success, failure and unavailability use the shared
clipboard helper. The controls remain hidden without JavaScript.
