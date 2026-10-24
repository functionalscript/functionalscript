## A `select` and a `button` beside `inputField` and `radios`

**Priority:** P3
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) exports `textField`, `inputField` and
`radios`, so a demo asks for a labelled field rather than writing one. It
has no select and no button, so each demo writes its own. At `c162c3a`, a
labelled `<select>` is built by hand in `crypto/secp`, `crypto/sign`,
`crypto/sha2`, `crypto/hmac`, `rtti/schema-demo` (twice), the B-tree
playground, `demo/examples` and `demo/hash`; a `button` helper is declared in
`crypto/secp` and `crypto/sign`:

```js
// crypto/secp/demo.f.mjs
const button = (name, label, disabled = false) => ['button', { type: 'button', name, ...(disabled ? { disabled: '' } : {}) }, label]
const select = (name, label, options, value) => ['p', ['label', { for: `secp-${name}` }, `${label} `],
    ['select', { id: `secp-${name}`, name }, ...options.map(o => ['option', { value: o, ...(o === value ? { selected: '' } : {}) }, o])]]
// crypto/sign/demo.f.mjs
const button = (name, label, disabled) => ['button', { type: 'button', name, ...(disabled ? { disabled: '' } : {}) }, label]
// "option, selected if current", four spellings: demo/hash `algorithmOption`,
// rtti/schema-demo `exampleOption` and `compareOption`, demo/examples inline
['option', a.name === picked.name ? { value: a.name, selected: '' } : { value: a.name }, a.name]
```

The copies have drifted as copies do: the `id` is prefixed `secp-` in one
demo and bare in the rest; the space after the label is inside the label text
in some and a separate `' '` node in others.

### Proposal

Three exports in the style of `inputField`: `option(value, text, selected)`,
`selectField({ name, label }, options)` taking option or optgroup elements,
and `button(name, label, disabled?)`. A demo keeps only its data — which
options exist and which is chosen.

### Tasks

- [ ] The three widgets, with proof and a case in the demo's own demo page.
- [ ] The nine demos over them; check each in the browser and link the
      previews in the PR.

### Related

- [oversized-utf8-input](./oversized-utf8-input.md) — touches the same hash
  demos.
