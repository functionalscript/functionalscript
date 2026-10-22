/**
 * The example of [`README.md`](./README.md) (Shared Values, Constants) as a
 * function of one number, for the page's WASM demo: one `const` reached by
 * two names: `dev` and `prod` are the same object.
 *
 * @module
 */

const port = 8080;
const server = { "port": port, "host": "localhost" };
const config = { "dev": server, "prod": server };
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [config.dev === config.prod, config.prod.port + a[0], config.dev.host];
