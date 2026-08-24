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
a.b(...c)
(a.b)(...c)
['()',
    a,
    [['|.', b],
    c
]

methodCall(a, b, c)
```

