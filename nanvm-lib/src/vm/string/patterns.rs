use super::{String, create::create};
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, Array, Function, IVm, Nullish, Number, ToAny, ToArray, ToString, Unpacked},
};

/// What a match is replaced with: a function called for each match, or the
/// template `GetSubstitution` reads. Which of the two is decided, and a
/// template converted by `ToString`, before any match is looked for, as
/// the algorithms order it.
pub(crate) enum Replacement<A: IVm> {
    Function(Function<A>),
    Template(String<A>),
}

impl<A: IVm> Replacement<A> {
    /// A function is called; anything else is `ToString`ed to a template.
    pub(crate) fn new(v: Any<A>) -> Result<Replacement<A>, Any<A>> {
        Ok(match Unpacked::from(v.clone()) {
            Unpacked::Function(f) => Replacement::Function(f),
            _ => Replacement::Template(v.to_string()?),
        })
    }

    /// The text for the match of `matched` at `position` in `string`: the
    /// function's answer to `(matched, position, string)` converted by
    /// `ToString`, or the template with its references substituted.
    fn text(
        &self,
        matched: &String<A>,
        position: u32,
        string: &String<A>,
    ) -> Result<Vec<u16>, Any<A>> {
        match self {
            Replacement::Function(f) => {
                let args = [
                    matched.clone().to_any(),
                    Number::from(f64::from(position)).to_any(),
                    string.clone().to_any(),
                ];
                Ok(f.call(args.to_array())?.to_string()?.into_iter().collect())
            }
            Replacement::Template(t) => Ok(substitution(t, matched, position, string)),
        }
    }
}

/// `GetSubstitution` (<https://tc39.es/ecma262/#sec-getsubstitution>) for a
/// string pattern, which has no captures and no named groups: `$$` is `$`,
/// `$&` the match, `` $` `` what precedes it and `$'` what follows it. Every
/// other `$` — `$1`, `$<name>` among them — stays as written, which is what
/// JavaScript answers when there is no capture to refer to.
fn substitution<A: IVm>(
    template: &String<A>,
    matched: &String<A>,
    position: u32,
    string: &String<A>,
) -> Vec<u16> {
    let t: Vec<u16> = template.clone().into_iter().collect();
    let s: Vec<u16> = string.clone().into_iter().collect();
    let tail = (position + matched.length()) as usize;
    let mut out = Vec::with_capacity(t.len());
    let mut i = 0;
    while i < t.len() {
        let special = t[i] == u16::from(b'$')
            && t.get(i + 1)
                .is_some_and(|&c| (*b"$&`'").map(u16::from).contains(&c));
        if !special {
            out.push(t[i]);
            i += 1;
            continue;
        }
        match t[i + 1] {
            c if c == u16::from(b'$') => out.push(c),
            c if c == u16::from(b'&') => out.extend(matched.clone()),
            c if c == u16::from(b'`') => out.extend_from_slice(&s[..position as usize]),
            _ => out.extend_from_slice(&s[tail..]),
        }
        i += 2;
    }
    out
}

impl<A: IVm> String<A> {
    /// The receiver with the matches of `pattern` at `positions` replaced, in
    /// order, the rest kept. A replacement function is called once per match,
    /// in order, and its first throw is the result.
    fn replace_at(
        &self,
        pattern: &String<A>,
        positions: &[u32],
        replacement: &Replacement<A>,
    ) -> Result<String<A>, Any<A>> {
        let units: Vec<u16> = self.clone().into_iter().collect();
        let mut out: Vec<u16> = Vec::new();
        let mut end = 0usize;
        for &p in positions {
            out.extend_from_slice(&units[end..p as usize]);
            out.extend(replacement.text(pattern, p, self)?);
            end = p as usize + pattern.length() as usize;
        }
        out.extend_from_slice(&units[end..]);
        create(out.len() as u64, out)
    }

    /// `String.prototype.replace(pattern, replacement)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.replace>): the first
    /// occurrence of `ToString(pattern)` replaced — an empty pattern matches
    /// at `0` — and the receiver itself when there is none.
    pub(crate) fn replace(
        &self,
        pattern: Any<A>,
        replacement: Any<A>,
    ) -> Result<String<A>, Any<A>> {
        let pattern = pattern.to_string()?;
        let replacement = Replacement::new(replacement)?;
        let positions: Vec<u32> = self.find_from(&pattern, 0).into_iter().collect();
        self.replace_at(&pattern, &positions, &replacement)
    }

    /// `String.prototype.replaceAll(pattern, replacement)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.replaceall>): every
    /// non-overlapping occurrence, found left to right before any is
    /// replaced. An empty pattern matches at every position, both ends
    /// included, so `"ab".replaceAll("", "-")` is `"-a-b-"`.
    pub(crate) fn replace_all(
        &self,
        pattern: Any<A>,
        replacement: Any<A>,
    ) -> Result<String<A>, Any<A>> {
        let pattern = pattern.to_string()?;
        let replacement = Replacement::new(replacement)?;
        let advance = pattern.length().max(1);
        let positions: Vec<u32> = std::iter::successors(self.find_from(&pattern, 0), |&p| {
            p.checked_add(advance)
                .and_then(|from| self.find_from(&pattern, from))
        })
        .collect();
        self.replace_at(&pattern, &positions, &replacement)
    }

    /// `String.prototype.split(separator, limit)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.split>): the pieces
    /// between occurrences of `ToString(separator)`, at most `limit` of them.
    /// `limit` is `ToUint32`, `2³² − 1` when `undefined`, and `0` answers
    /// `[]`; an `undefined` separator answers `[receiver]`; an empty one
    /// splits into code units, so a surrogate pair is two pieces.
    pub(crate) fn split(&self, separator: Any<A>, limit: Any<A>) -> Result<Array<A>, Any<A>> {
        let is_undefined = |v: &Any<A>| {
            matches!(
                Unpacked::from(v.clone()),
                Unpacked::Nullish(Nullish::Undefined)
            )
        };
        let limit = if is_undefined(&limit) {
            u32::MAX
        } else {
            limit.to_number()?.to_uint32()
        };
        let separator_is_undefined = is_undefined(&separator);
        let separator = separator.to_string()?;
        if limit == 0 {
            return Ok([].to_array());
        }
        if separator_is_undefined {
            return Ok([self.clone().to_any()].to_array());
        }
        let len = self.length();
        let piece =
            |from: u32, to: u32| -> Any<A> { (from..to).map(|i| self[i]).to_string().to_any() };
        if separator.length() == 0 {
            return Ok((0..len.min(limit)).map(|i| piece(i, i + 1)).to_array());
        }
        if len == 0 {
            return Ok([self.clone().to_any()].to_array());
        }
        let mut pieces = Vec::new();
        let mut start = 0;
        while let Some(j) = self.find_from(&separator, start) {
            pieces.push(piece(start, j));
            if pieces.len() as u32 == limit {
                return Ok(pieces.to_array());
            }
            start = j + separator.length();
        }
        pieces.push(piece(start, len));
        Ok(pieces.to_array())
    }
}

#[cfg(test)]
mod tests {
    use super::substitution;
    use crate::{
        naive::Naive,
        vm::{Any, Array, IStaticFunction, Nullish, String, ToAny, ToArray},
    };

    type A = Naive;

    fn s(v: &str) -> String<A> {
        v.into()
    }
    fn a(v: &str) -> Any<A> {
        v.into()
    }
    fn pieces(r: Result<Array<A>, Any<A>>) -> Vec<Any<A>> {
        r.unwrap().into_iter().collect()
    }

    #[test]
    fn substitutions() {
        let sub = |t: &str| substitution(&s(t), &s("X"), 1, &s("aXb"));
        let units = |v: &str| v.encode_utf16().collect::<Vec<u16>>();
        assert_eq!(sub("[$&]"), units("[X]"));
        assert_eq!(sub("$$"), units("$"));
        assert_eq!(sub("$`"), units("a"));
        assert_eq!(sub("$'"), units("b"));
        assert_eq!(sub("$1$<n>$"), units("$1$<n>$"));
    }

    #[test]
    fn replace() {
        assert_eq!(s("aXbX").replace(a("X"), a("-")), Ok(s("a-bX")));
        assert_eq!(s("ab").replace(a(""), a("-")), Ok(s("-ab")));
        assert_eq!(s("ab").replace(a("z"), a("-")), Ok(s("ab")));
        assert_eq!(s("aXbX").replace_all(a("X"), a("$&$&")), Ok(s("aXXbXX")));
        assert_eq!(s("ab").replace_all(a(""), a("-")), Ok(s("-a-b-")));
        assert_eq!(s("aaa").replace_all(a("aa"), a("b")), Ok(s("ba")));
        let position = A::static_function(|_, args| Ok(args[1].clone()), 0, [].to_array()).to_any();
        assert_eq!(s("aXbX").replace_all(a("X"), position), Ok(s("a1b3")));
    }

    #[test]
    fn split() {
        let u = || Nullish::Undefined.to_any();
        assert_eq!(
            pieces(s("a,b,,c").split(a(","), u())),
            vec![a("a"), a("b"), a(""), a("c")]
        );
        assert_eq!(pieces(s("a,b").split(u(), u())), vec![a("a,b")]);
        assert_eq!(
            pieces(s("abc").split(a(""), u())),
            vec![a("a"), a("b"), a("c")]
        );
        assert_eq!(
            pieces(s("a,b,c").split(a(","), 2.0.to_any())),
            vec![a("a"), a("b")]
        );
        assert_eq!(pieces(s("a,b").split(a(","), 0.0.to_any())), vec![]);
        assert_eq!(pieces(s("").split(a(","), u())), vec![a("")]);
        assert_eq!(pieces(s("").split(a(""), u())), vec![]);
        assert_eq!(pieces(s("a,").split(a(","), u())), vec![a("a"), a("")]);
    }
}
