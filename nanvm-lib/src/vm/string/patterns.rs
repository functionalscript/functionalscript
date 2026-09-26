use super::{String, create::create};
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, Array, Function, IVm, Nullish, Number, ToAny, ToArray, ToString, Unpacked},
};

/// What a match is replaced with: a function called for each match, or the
/// template `GetSubstitution` reads, parsed once into its [`Part`]s. Which of
/// the two is decided, and a template converted by `ToString`, before any
/// match is looked for, as the algorithms order it.
pub(crate) enum Replacement<A: IVm> {
    Function(Function<A>),
    Template(Vec<Part>),
}

/// A piece of the text that replaces one match, which is always a run of
/// code units already held: a template's literal text, or a slice of the
/// receiver, or a function's answer.
#[derive(Debug, PartialEq)]
pub(crate) enum Part {
    Literal(Vec<u16>),
    /// `$&`, the match.
    Matched,
    /// `` $` ``, what precedes the match.
    Before,
    /// `$'`, what follows the match.
    After,
    /// The replacement function's answer for this match.
    Answer,
}

/// A run of a replacement's result: code units already held, or a
/// replacement function's answer, read only once the result's length is
/// known to fit, so answers sharing one string are never copied to count
/// them.
enum Piece<'a, A: IVm> {
    Units(&'a [u16]),
    Answer(&'a String<A>),
}

impl<'a, A: IVm> Piece<'a, A> {
    fn length(&self) -> u64 {
        match self {
            Piece::Units(units) => units.len() as u64,
            Piece::Answer(answer) => u64::from(answer.length()),
        }
    }

    fn units(self) -> Box<dyn Iterator<Item = u16> + 'a> {
        match self {
            Piece::Units(units) => Box::new(units.iter().copied()),
            Piece::Answer(answer) => Box::new(answer.clone().into_iter()),
        }
    }
}

impl<A: IVm> Replacement<A> {
    /// A function is called; anything else is `ToString`ed to a template.
    pub(crate) fn new(v: Any<A>) -> Result<Replacement<A>, Any<A>> {
        Ok(match Unpacked::from(v.clone()) {
            Unpacked::Function(f) => Replacement::Function(f),
            _ => Replacement::Template(parts(&v.to_string()?)),
        })
    }
}

/// `GetSubstitution` (<https://tc39.es/ecma262/#sec-getsubstitution>) for a
/// string pattern, which has no captures and no named groups, as parts: `$$`
/// is `$`, `$&` the match, `` $` `` what precedes it and `$'` what follows
/// it. Every other `$` — `$1`, `$<name>` among them — stays as written, which
/// is what JavaScript answers when there is no capture to refer to.
fn parts<A: IVm>(template: &String<A>) -> Vec<Part> {
    let t: Vec<u16> = template.clone().into_iter().collect();
    let mut parts = Vec::new();
    let mut literal = Vec::new();
    let mut i = 0;
    while i < t.len() {
        let reference = (t[i] == u16::from(b'$'))
            .then(|| t.get(i + 1).copied())
            .flatten()
            .and_then(|c| match u8::try_from(c) {
                Ok(b'$') => Some(None),
                Ok(b'&') => Some(Some(Part::Matched)),
                Ok(b'`') => Some(Some(Part::Before)),
                Ok(b'\'') => Some(Some(Part::After)),
                _ => None,
            });
        match reference {
            None => {
                literal.push(t[i]);
                i += 1;
                continue;
            }
            Some(None) => literal.push(u16::from(b'$')),
            Some(Some(part)) => {
                if !literal.is_empty() {
                    parts.push(Part::Literal(std::mem::take(&mut literal)));
                }
                parts.push(part);
            }
        }
        i += 2;
    }
    if !literal.is_empty() {
        parts.push(Part::Literal(literal));
    }
    parts
}

impl<A: IVm> String<A> {
    /// The receiver with the matches of `pattern` at `positions` replaced, in
    /// order, the rest kept. A replacement function is called once per match,
    /// in order, and its first throw is the result. The receiver is read
    /// once, and the result is counted before it is built, so a result past
    /// the length limit is refused without building it.
    fn replace_at(
        &self,
        pattern: &String<A>,
        positions: &[u32],
        replacement: &Replacement<A>,
    ) -> Result<String<A>, Any<A>> {
        let units: Vec<u16> = self.clone().into_iter().collect();
        let (template, answers): (&[Part], Vec<String<A>>) = match replacement {
            Replacement::Template(parts) => (parts, Vec::new()),
            Replacement::Function(f) => {
                let answer = |p: u32| -> Result<String<A>, Any<A>> {
                    let args = [
                        pattern.clone().to_any(),
                        Number::from(f64::from(p)).to_any(),
                        self.clone().to_any(),
                    ];
                    f.call(args.to_array())?.to_string()
                };
                let answers: Result<Vec<String<A>>, Any<A>> =
                    positions.iter().map(|&p| answer(p)).collect();
                (&[Part::Answer], answers?)
            }
        };
        let (units, answers, m) = (&units, &answers, pattern.length() as usize);
        let pieces = || {
            let ends = std::iter::once(0).chain(positions.iter().map(|&p| p as usize + m));
            positions
                .iter()
                .zip(ends.clone())
                .enumerate()
                .flat_map(move |(i, (&p, start))| {
                    let p = p as usize;
                    std::iter::once(Piece::Units(&units[start..p])).chain(template.iter().map(
                        move |part| match part {
                            Part::Literal(v) => Piece::Units(&v[..]),
                            Part::Matched => Piece::Units(&units[p..p + m]),
                            Part::Before => Piece::Units(&units[..p]),
                            Part::After => Piece::Units(&units[p + m..]),
                            Part::Answer => Piece::Answer(&answers[i]),
                        },
                    ))
                })
                .chain(std::iter::once(Piece::Units(
                    &units[ends.last().unwrap_or(0)..],
                )))
        };
        let len = pieces().fold(0u64, |n, piece| n.saturating_add(piece.length()));
        create(len, pieces().flat_map(Piece::units))
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
        let sub = |t: &str| s("aXb").replace(a("X"), a(t));
        assert_eq!(sub("[$&]"), Ok(s("a[X]b")));
        assert_eq!(sub("$$"), Ok(s("a$b")));
        assert_eq!(sub("$`"), Ok(s("aab")));
        assert_eq!(sub("$'"), Ok(s("abb")));
        assert_eq!(sub("$1$<n>$"), Ok(s("a$1$<n>$b")));
        assert_eq!(sub("$$&"), Ok(s("a$&b")));
    }

    /// `"a".repeat(92681).replaceAll("", "$`")` inserts every prefix, just
    /// past `2³² − 1` code units: refused, counted without building it.
    #[test]
    fn too_long_is_refused_before_it_is_built() {
        let wide: String<A> = s("a").repeat(92681.0.to_any()).unwrap();
        assert!(wide.replace_all(a(""), a("$`")).is_err());
    }

    /// A function answering the receiver itself for each of 2¹⁶ + 1 matches
    /// is past the limit too: the answers are one shared string, counted by
    /// length, not copied.
    #[test]
    fn too_long_answers_are_refused_before_they_are_copied() {
        let wide: String<A> = s("a").repeat(65536.0.to_any()).unwrap();
        let itself = A::static_function(|_, args| Ok(args[2].clone()), 0, [].to_array()).to_any();
        assert!(wide.replace_all(a(""), itself).is_err());
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
