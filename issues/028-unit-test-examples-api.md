# 28. Make a distinction between unit tests, examples, and API tests.

- Unit tests are completely deterministic. They run every time the module is loaded, so they must be very, very simple and check basic hypotheses. They are not available as a public interface.
  ```ts
  import { assert } from 'dev/module.f.ts'
  assert(2 + 2 === 4)
  ```
- Examples use only public API and are located in `*example.f.ts` files.
- API tests use only public API and are located in `*test.f.ts` files.
