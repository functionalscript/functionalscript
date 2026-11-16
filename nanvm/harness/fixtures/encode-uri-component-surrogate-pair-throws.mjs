// A high surrogate followed by a non-low unit is malformed too.
export default encodeURIComponent('\ud800x');
