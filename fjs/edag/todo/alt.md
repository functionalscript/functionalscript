# Alternative Definition of EDAG

```ts
// a.b
['.', a:exp, b:exp]
['|.', b:exp]

// a(...b)
['()', a:exp, lambdas, b:exp]
['|()', b:exp]

// a?.b
['?.', a:exp, b:exp, lambdas]
['|?.', b:exp]

// a?.(...b)
['?.()', a:exp, lambdas, b:exp, lambdas]
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

|JS           |exp                                              |lambda                |
|-------------|-------------------------------------------------|----------------------|
|`a.b`        |`['.'   , a:exp, b:index                       ]`|`['\|.'   , b:index]` |
|`a?.bc`      |`['?.'  , a:exp, b:index  , c:lambdas          ]`|`['\|?.'  , b:index]` |
|`ab(...c)`   |`['()'  , a:exp, b:lambdas, c:exp              ]`|`['\|()'  , b:exp]`   |
|`ab?.(...b)d`|`['?.()', a:exp, b:lambdas, b:exp    , d:lambda]`|`['\|?.()', b:exp]`   |
