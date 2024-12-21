# HTML

|HTML                                        |FunctionalScript DSL                             |
|--------------------------------------------|-------------------------------------------------|
|`<br>`                                      |`['br']`                                         |
|`<img src="https://example.com/image.jpg">` |`['img',{src:'https://example.com/image.jpg'}]`  |
|`<a href="https://example.com/">Example</a>`|`['a',{href:'https://example.com/'}, 'Example']` |
|`<ul><li>Apple</li><li>Tomato</li></ul>`    |`['ul',['li','Apple'],['li','Tomato']]`          |

## Example

```html
<html>
    <head>
        <title>Page</title>
    </head>
    <body>
        <a href="https://example.com/">Example</a>
    </body>
</html>
```

```js
['html',
    ['head',
        ['title', 'Page']
    ]
    ['body',
        ['a', { href: 'https://example.com/' }, 'Example']
    ]
]
```
