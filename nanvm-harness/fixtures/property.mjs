/**
 * Compiled by `fjs compile` into `../gen.fixtures/property.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins `Any::dot(…).end()`, the property read: the exported
 * value is a scalar read out of an object built inline, via a string-keyed
 * `.` access.
 */
const obj = { a: 42 };
export default obj.a;
