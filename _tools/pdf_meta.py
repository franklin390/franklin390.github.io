"""Post-process a Chrome-printed CV PDF: Title/Author/Subject/Keywords + document language (/Lang).
Usage: python -I pdf_meta.py <in.pdf> <out.pdf> <lang> <title> <subject> <keywords>"""
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject

src, dst, lang, title, subject, keywords = sys.argv[1:7]
w = PdfWriter(clone_from=PdfReader(src))
w.add_metadata({"/Title": title, "/Author": "Franklin Ferreira", "/Subject": subject, "/Keywords": keywords, "/Creator": "franklin390.github.io CV builder", "/Producer": "Chromium + pypdf"})
w._root_object[NameObject("/Lang")] = TextStringObject(lang)
with open(dst, "wb") as f:
    w.write(f)
print("meta ok", dst)
