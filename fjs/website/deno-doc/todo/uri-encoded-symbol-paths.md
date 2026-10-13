## Let Deno own URI-safe symbol-page paths

`deno doc --html` writes object property names directly into filenames. An
operator-keyed property can therefore produce `binary.<<.html`, and a slash
produces the broken directory shape `rustName./.html`. Cloudflare Workers
rejects these raw asset-manifest paths; see
[workers-sdk#14461](https://github.com/cloudflare/workers-sdk/issues/14461).

The website build currently percent-encodes every generated path, collapses
the slash-property shape, and rewrites Deno's HTML and search-index links. That
workaround belongs at the host boundary only until the generator supplies
URI-safe, internally consistent output itself.

- [ ] File an upstream `denoland/deno_doc` report with the operator-keyed
      reproduction.
- [ ] Link the report here and track its release.
- [ ] Remove the host rewrite once the pinned Deno version emits URI-safe
      filenames and links, retaining a refusal for invalid asset paths.
