#!/usr/bin/env python3
"""Build data/catalog/courses.json from the official TCU Undergraduate 2026-2027 Catalog PDF.

Usage:
    python3 -m venv .venv && .venv/bin/pip install pypdf
    .venv/bin/python scripts/build_catalog.py "/path/to/Undergrad Catalog.pdf"

The course-description section of the catalog (PDF pages 1296-2791) lists each page's course
headers first, then one block per course that starts with "Department(s)". Headers and blocks
pair one-to-one on every page, so we pair per page (never across pages) to avoid drift.
Pages where the counts do not match are logged and their unmatched courses are left without a
description rather than guessed.
"""
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

FIRST_PAGE, LAST_PAGE = 1296, 2791
SOURCE = {
    "id": "S1",
    "title": "TCU Undergraduate 2026-2027 Catalog",
    "owner": "Texas Christian University",
    "catalogYear": "2026-2027",
    "type": "catalog",
}
HDR = re.compile(r"(?<![A-Za-z0-9])([A-Z]{2,8}) ?(\d{5}) -(?=\s)")
FOOTER = re.compile(r"Texas Christian University\s*\n\d+ / \d+\s*$")


def page_texts(pdf_path):
    reader = PdfReader(pdf_path)
    out = {}
    for n in range(FIRST_PAGE, min(LAST_PAGE, len(reader.pages)) + 1):
        t = reader.pages[n - 1].extract_text() or ""
        t = re.sub(r"[ \t]+\n", "\n", t.strip())
        out[n] = FOOTER.sub("", t)
    return out


def headers_of(text):
    ms = list(HDR.finditer(text))
    found = []
    for i, m in enumerate(ms):
        end = ms[i + 1].start() if i + 1 < len(ms) else len(text)
        chunk = text[m.end():end]
        chunk = chunk.split("Department(s)")[0]
        chunk = re.split(r"\b(Overview|Program Code|Cross Listed Courses|All Courses)\b", chunk)[0]
        found.append((m.group(1), m.group(2), re.sub(r"\s+", " ", chunk).strip(" -")))
    return found


def blocks_of(text):
    starts = [m.start() for m in re.finditer(r"Department\(s\)", text)]
    blocks = []
    for i, s in enumerate(starts):
        e = starts[i + 1] if i + 1 < len(starts) else len(text)
        blocks.append(text[s:e])
    return blocks


def field(block, label):
    m = re.search(label + r"\s*\n(.*?)(?=\n(?:Long Description|Career|Course Typically|Grading Basis|Cross Listed|Department\(s\))|\Z)", block, re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def parse_block(block, overflow):
    dept = field(block, r"Department\(s\)")
    desc = ""
    m = re.search(r"Long Description \(Catalog\s*\nDescription\)\s*\n(.*?)(?=\nCourse Typically|\nCareer\n|\Z)", block, re.S)
    if m:
        desc = re.sub(r"\s+", " ", m.group(1)).strip()
    full = block + "\n" + overflow
    off = re.search(r"Course Typically\s*\nOffered\s*\n([^\n]*)", full)
    grading = re.search(r"Grading Basis\s*\n([^\n]*)", full)
    cross = []
    if "Cross Listed Courses" in block:
        cross = sorted(set(re.findall(r"([A-Z]{2,5}\d{5})", block.split("Cross Listed Courses", 1)[1])))
    return dept, desc, (off.group(1).strip() if off else ""), (grading.group(1).strip() if grading else ""), cross


def prerequisite_text(desc):
    m = re.search(r"(Prerequisites?|Corequisites?)\s*:?\s*(.*?)(?:(?<=[a-z\)])\.\s+(?=[A-Z][a-z]+ [a-z]+)|$)", desc)
    return re.sub(r"\s+", " ", m.group(0)).strip() if m else ""


def main(pdf_path, out_dir):
    pages = page_texts(pdf_path)
    courses, mismatches = [], []
    for n in sorted(pages):
        text = pages[n]
        hs, bs = headers_of(text), blocks_of(text)
        nxt = pages.get(n + 1, "")
        pre = nxt.split("Department(s)")[0] if nxt else ""
        overflow = pre if re.search(r"Course Typically|Grading Basis", pre) else ""
        if len(hs) != len(bs):
            mismatches.append({"page": n, "headers": len(hs), "blocks": len(bs)})
        for i, (subj, num, title) in enumerate(hs):
            rec = {
                "code": f"{subj} {num}", "subject": subj, "number": num, "title": title,
                "department": "", "description": "", "prerequisiteText": "", "offered": "",
                "grading": "", "crossListed": [], "catalogPage": n, "sourceId": SOURCE["id"],
                "paired": i < len(bs) and len(hs) == len(bs),
            }
            if i < len(bs) and len(hs) == len(bs):
                last = i == len(bs) - 1
                dept, desc, off, grading, cross = parse_block(bs[i], overflow if last else "")
                rec.update(department=dept, description=desc, prerequisiteText=prerequisite_text(desc),
                           offered=off, grading=grading, crossListed=cross)
            courses.append(rec)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "courses.json").write_text(json.dumps({"source": SOURCE, "courses": courses}, ensure_ascii=False))
    (out / "courses.mismatches.json").write_text(json.dumps(mismatches, indent=1))
    paired = sum(1 for c in courses if c["paired"])
    print(f"{len(courses)} courses, {paired} paired with a description block, {len(mismatches)} mismatched pages")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], Path(__file__).resolve().parent.parent / "data" / "catalog")
