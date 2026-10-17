#!/usr/bin/env python3
"""Render data/sample/sample-transcript.txt as a text PDF (public/sample-transcript.pdf) so the upload path can be demoed.

    .venv/bin/pip install reportlab && .venv/bin/python scripts/make_sample_pdf.py
"""
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

root = Path(__file__).resolve().parent.parent
lines = (root / "data" / "sample" / "sample-transcript.txt").read_text().splitlines()
out = root / "public" / "sample-transcript.pdf"
c = canvas.Canvas(str(out), pagesize=letter)
c.setTitle("Sample transcript (demo data)")
w, h = letter
y = h - 48
c.setFont("Helvetica", 9)
for line in lines:
    if y < 48:
        c.showPage(); c.setFont("Helvetica", 9); y = h - 48
    c.drawString(48, y, line)
    y -= 12
c.save()
print("wrote", out)
