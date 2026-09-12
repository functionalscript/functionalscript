A **digital document** is a complete, bounded unit of digital content, represented by a finite sequence of bits.

When discussing digital infrastructure, we use **document** for short.

“Complete” describes the unit’s boundaries: it has a beginning and an end and can be copied exactly. A document may contain text, an image, audio, video, code, or structured data. It may also reference or depend on other documents.

A document’s name, authorship, and timestamps can be described separately; they are not intrinsic to its content. For example, the same document can be stored under different filenames. These are distinct files, but they contain the same document.

A document can have multiple names and identifiers:

* **Hash identifiers:** different hash algorithms produce their respective identifiers, such as `sha256:...` and `sha512:...`. For a given hash algorithm, the same document always has the same hash.
* **Local names:** the same document can be stored in two distinct files, such as `myDocument.txt` and `notes.txt`, even within the same directory.
* **URLs:** different URLs can reference the same document, making it available from multiple locations.

The document’s identity is independent of these names and locations.

The term **document** emphasizes meaningful content with clear boundaries. Extending this familiar category to images, code, and other digital formats requires less explanation than introducing a new term or contradicting familiar expectations.

| Term         | Reasons for choosing or avoiding it                                                                                                                                                                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | Suggests meaningful, self-contained content—something you can open, copy, and share. People may not initially associate images or code with documents, but this broadens an existing meaning while preserving its familiar properties.                                                                      |
| **File**     | Usually implies a specific filename, such as `myDocument.txt`, an extension, and filesystem attributes, such as creation and modification times. Copying a file typically preserves its extension. Renaming it changes something people consider part of the file, even when the content remains unchanged. |
| **Object**   | Often associated with OOP and mutable state. Objects can have runtime identity, pointers, and relationships with other objects that cannot be fully preserved by serialization. An object is therefore not necessarily expressible as a self-contained, finite sequence of bits.                            |
| **Asset**    | Usually suggests ownership, and often commercial value. Neither is intrinsic to a document.                                                                                                                                                                                                                 |
| **Resource** | Too broad to imply one complete, downloadable unit. A resource may be a service, something mutable, or an entire collection of documents.                                                                                                                                                                   |
| **Item**     | Usually means an item *of something*, such as an array or collection. By itself, it does not suggest meaningful, self-contained content.                                                                                                                                                                    |
| **Piece**    | Suggests part of something larger and prompts the question “a piece of what?” It does not clearly convey completeness.                                                                                                                                                                                      |
| **Block**    | Often means a fragment: a file may be split across multiple disk blocks. It is also technical and may evoke blockchain.                                                                                                                                                                                     |
| **Content**  | Describes the material without establishing its boundaries. It may encompass many files and documents rather than one discrete unit.                                                                                                                                                                        |

**Document databases** provide a precedent for using *document* beyond conventional text and office files: a document can be a bounded unit of structured data.

Even someone unfamiliar with document databases can reasonably expect a document to be something they could retrieve and save as a file. That intuition is useful regardless of a particular database’s export capabilities: the term already communicates a discrete, transferable unit.

There is also a physical precedent for distinguishing a file from a document. A physical file can be a folder or collection that holds documents. Moving a document to another file, or changing the file’s label, does not change the document itself.

The same distinction is useful in digital infrastructure: a digital file stores a document’s bits and associates them with a filename and filesystem metadata. Changing those attributes does not change the document’s content.

**A file is a container; a document is its content.**
