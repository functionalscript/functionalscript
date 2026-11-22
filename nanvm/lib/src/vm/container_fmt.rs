use core::fmt::{Debug, Formatter, Result, Write};

pub fn container_fmt(
    items: impl IntoIterator<Item: Debug>,
    open: char,
    close: char,
    f: &mut Formatter<'_>,
) -> Result {
    f.write_char(open)?;
    for (i, item) in items.into_iter().enumerate() {
        if i != 0 {
            f.write_char(',')?;
        }
        item.fmt(f)?;
    }
    f.write_char(close)
}
