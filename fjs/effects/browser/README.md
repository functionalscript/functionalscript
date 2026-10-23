# Browser effects

The operations a page of the site performs that only a browser has.
[`module.f.mjs`](./module.f.mjs) declares them, [`types.ts`](./types.ts) says
what each does, and [`module.mjs`](./module.mjs) is the page's handlers.

|Operation          |Does                                                              |
|-------------------|------------------------------------------------------------------|
|`fetchText(path)`  |fetches a file of the site as text                                |
|`instantiate(path)`|fetches and instantiates a WebAssembly module                    |
|`jsHeapSize()`     |the page's JavaScript heap size, where the browser reports one    |

A demo names these, and the shared demo runtime performs them
([`website/README.md`](../../website/README.md#a-demo-shows-what-a-module-does)).
The NaNVM demos load their WebAssembly this way.
