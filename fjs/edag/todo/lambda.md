```ts
a(...b)
['()'
    a,
    [],
    b
]

call(a, b)
```

```ts
(a.b)(...c)
a.b(...c)
['()',
    a,
    [['|.', b]],
    c
]

methodCall(a, b, c)
```

```ts
(a?.b)(...c)
['()',
    a,
    [['|?.', b]]
    c
]

isNullish(a) ? call(undefined, c) : methodCall(a, b, c)
```

```ts
a?.b(...c)
['?.',
    a,
    b,
    [['()', c]]
]

isNullish(a) ? undefined : methodCall(a, b, c)
```

```ts
(a.b)?.c
a.b?.c
['?.',
    ['.', a, b],
    c,
    [],
]

isNullish(a.b) ? undefined : a.b.c
```

```ts
(a.b)?.(...c)
a.b?.(...c)
['?.()',
    a,
    ['|.', b],
    c,
    []
]

isNullish(a.b) ? undefined : a.b(...c)
```
