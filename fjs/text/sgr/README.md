# SGR (Select Graphic Rendition) parameters

https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_(Select_Graphic_Rendition)_parameters

The module builds escape sequences and writes them to a stream, stripping
them where the stream is no TTY. A writer that rewrites text already printed —
a progress line redrawn with backspaces — is no SGR concern: it uses no escape
sequence, and belongs in a module of its own once something needs it.
