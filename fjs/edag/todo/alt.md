# Alternative Definition of EDAG

```ts
// a.b
['.', a:exp, b:exp]
['|.', b:exp]

// a(...b)
['()', a:exp, lambda, b:exp]
['|()', b:exp]

// a?.b
['?.', a:exp, b:exp, lambda]
['|?.', b:exp]

// a?.(...b)
['?.()', a:exp, lambda, b:exp, lambda]
['|.?()', b:exp]
```

## Example

```ts
// exp:
a?.b?.(...c)
// edag:
['?.',
    a,
    b,
    [['|?.()', c]]
]

// exp:
(a?.b.c)(...d)
// edag:
['()',
    a,
    [
        ['|?.', b],
        ['|.', c],
    ],
    d
]

// exp:
(a?.(...b).c)(...d)
// edag:
['()',
    a,
    [
        ['|?.()', b],
        ['|.', c],
    ],
    d
]

// a?.b?.c.d
['?.',
    a,
    b,
    [   ['|?.', c],
        ['|.', d]
    ],
]
```

|JS         |exp                                         |lambda             |
|-----------|--------------------------------------------|-------------------|
|`a.b`      |`['.', a:exp, b:index]`                     |`['\|.', b:index]` |
|`aO(...b)` |`['()', a:exp, O:lambda, b:exp]`            |`['\|()', b:exp]`  |
|`a?.b`     |`['?.', a:exp, b:index, O:lambda]`          |`['\|?.', b:index]`|
|`a?.(...b)`|`['?.()', a:exp, O:lambda, b:exp, O:lambda]`|`['\|?.()', b:exp]`|
