- `djs/tokenizer`: an unterminated block comment is reported at its `/*` rather
  than at the end of input, matching an unterminated string. Unterminated
  comments now say `*/ expected` and malformed numbers `invalid number`, in
  place of a generic `invalid token`.
