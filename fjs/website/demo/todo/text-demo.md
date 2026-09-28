## text-demo. Five demos repeat one "textarea in, view out" skeleton

**Priority:** P4
**Status:** open

### Problem

The `Demo<State, Event>` protocol is general, and most demos are the
same special case of it: the state is a text, the page shows a labelled
textarea holding it and something derived from it. Each of
`fjs/media/json`, `fjs/media/markdown`, `fjs/media/datajs`,
`fjs/fsc/edag` and `fjs/website/changelog` writes the case out:

```js
update: state => event => pureOk(event.kind === 'input' ? event.value : state),
…
['p',
    ['label', { for: 'datajs' }, 'DataJS '],
    ['textarea', { id: 'datajs', name: 'datajs', rows: '8' }, text],
],
```

The DataJS and EDAG demos also share an examples drop-down from
`fjs/website/demo/examples`, and each writes the same `update` again to
route its pick through `picker.pick` and the same `picker.view` above
the textarea. The changelog demo writes the textarea twice, once per
branch of its `view`. The `id`/`name` pair is what the page runtime's `refocus` and
`resize` key on, so each copy is a place that can break them, and `rows`
already varies between copies for no reason a reader can see.

`fjs/crypto/sha2`'s demo shares the `update` line but not the control:
its input is a single-line `['input', { type: 'text', … }]`, which is
right for a message to hash and would be wrong as a textarea. It is not
one of the five.

### Proposal

A named layer beside the protocol, in `fjs/website/demo/module.f.mjs`:

```ts
export const textDemo: (o: { name: string, label: string, rows?: number, init: string, examples?: Examples })
    => (render: (text: string) => readonly Node[]) => Demo<string, DemoEvent>
```

It owns `update` and the textarea, and spreads what `render` answers
after it; each demo keeps its initial text and its `render`. With
`examples`, it also owns the drop-down: it builds the picker, draws it
above the textarea, and routes a pick through `pick`, as the DataJS and
EDAG demos do by hand today. Without `examples`, there is no drop-down
and `update` is the one-line version. The answer
is a list of nodes, not one element, because the JSON demo's view puts
two siblings after its textarea, a `p` and a `pre`, and a single
`Element` would force a wrapper the page does not have today. The SHA-2 demo stays as it is. If a second single-line
demo appears, the control kind becomes a parameter and both take it;
one is not a reason to widen the helper.

### Tasks

- [ ] `textDemo` with a proof; the five demos through it.
- [ ] `tsc`, `fjs test`; the five demo pages behave as before.
