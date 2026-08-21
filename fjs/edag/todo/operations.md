# Operations

| Syntax      | EDAG             |
|-------------|------------------|
| `a.b`       | `['.'   , a, b]` |
| `a(...b)`   | `['()'  , a, b]` |
| `a?.b`      | `['?.'  , a, b]` |
| `a?.(...b)` | `['?.()', a, b]` |

## Combinations

HCF is a hidden control flow.

|Syntax               |EDAG w/o HCF             |HCF      |Example             |Result     |
|---------------------|-------------------------|---------|--------------------|-----------|
|`a.b.c`              |`['.' , ['.' , a, b], c]`|         |`[].at.name`        |`'at'`     |
|                     |                         |         |                    |           |
|`a.b(...c)`          |`['()', ['.' , a, b], c]`|this     |`[].at(0)`          |`undefined`|
|`(a.b)(...c)`        |`['()', ['.' , a, b], c]`|this     |`([].at)(0)`        |`undefined`|
|`const x=a.b;x(...c)`|`['()', ['.' , a, b], c]`|         |`const x=[].at;x(0)`|throws     |
|                     |                         |         |                    |           |
|`a?.b.c`             |`['.' , ['.?', a, b], c]`|undefined|`undefined?.b.c`    |`undefined`|
|`(a?.b).c`           |`['.' , ['.?', a, b], c]`|         |`(undefined?.b).c`  |throws     |

We need to design operators that aware of HCF.
