// A rest-only fixed parameter must reject undefined even when unused.
/** @type {(source: object) => number} */
const ignore = ({ ...unused }) => 7;
// @ts-expect-error — undefined cannot supply an object-rest source.
export default ignore(undefined);
