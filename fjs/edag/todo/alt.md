# Alternative Definition of EDAG

```ts
// a.b
['.', a:exp, b:exp]
['|.', b:exp]

// a(...b)
['()', a:exp, b:exp]
['|()', b:exp]

// a?.b
['?.', a:exp, b:exp, option(lambda)]
['|?.', b:exp, option(lambda)]

// a?.(...b)
['?.()', a:exp, b:exp, option(lambda)]
['|.?()', b:exp, option(lambda)]

// with explicit this

// aO(b)
['this()', a:exp, O:lambda, b: exp]

// aO?.(b)
['this?.()', a:exp, O:lambda, b: exp, option(lambda)]
```

## Example

```ts
// exp:
a?.b?.(...c)
// edag:
['?.',
    a,
    b,
    ['|?.()', c]
]

// exp:
(a?.b.c)(...d)
// edag:
['this()',
    a,
    ['|?.', b,
        ['|.', c]
    ],
    d
]

// exp:
(a?.(...b).c)(...d)
// edag:
['this()',
    a,
    ['|?.()', b,
        ['|.', c]
    ],
    d
]

// a?.(b?.c).d
['?.',
    a,
    b,
    ['|?.',
        c,
        ['|.', d]
    ],
]

// a?.b?.c.d
['?.',
    a,
    b,
    ['|?.',
        c,
        ['|.', d]
    ],
]
```

|JS         |exp                           |lambda                   |
|-----------|------------------------------|-------------------------|
|`a.b`      |`['.', a:exp, b:exp]`         |`['\|.', b:exp]`         |
|`a(...b)`  |`['()', a:exp, b:exp]`        |`['\|()', b:exp]`        |
|`a?.b`     |`['?.', a:exp, b:exp, cont]`  |`['\|?.', b:exp, cont]`  |
|`a?.(...b)`|`['?.()', a:exp, b:exp, cont]`|`['\|?.()', b:exp, cont]`|

|JS            |exp                                          |
|--------------|---------------------------------------------|
|`(aO)(...b)`  |`['this()', a:exp, O:lambda, b: exp]`        |
|`(aO)?.(...b)`|`['this?.()', a:exp, O:lambda, b: exp, cont]`|
