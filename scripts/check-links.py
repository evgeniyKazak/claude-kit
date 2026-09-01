#!/usr/bin/env python3
"""Linkrot check for kit-root docs. Template ../../-style links resolve only after
installation onto a target stack and are out of scope here."""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = [p for p in [ROOT / n for n in ("README.md", "SETUP.md", "UPDATE.md", "CHANGELOG.md")] if p.exists()]
FILES += sorted((ROOT / "docs").glob("*.md"))

# CI-generated artifacts: committed by the diagram workflow after render, so a fresh
# checkout may not have them yet.
CI_GENERATED = {"docs/boilerplate-architecture.png"}

broken = 0
for f in FILES:
    for m in re.finditer(r"\]\(([^)#\s]+?)(?:#[^)]*)?\)", f.read_text(encoding="utf-8")):
        target = m.group(1)
        if target.startswith(("http://", "https://", "mailto:")) or "<" in target:
            continue
        resolved = (f.parent / target).resolve()
        if resolved.is_relative_to(ROOT) and str(resolved.relative_to(ROOT)) in CI_GENERATED:
            continue
        if not (f.parent / target).exists():
            print(f"BROKEN: {f.relative_to(ROOT)} -> {target}")
            broken += 1
print(f"checked {len(FILES)} files, broken links: {broken}")
sys.exit(1 if broken else 0)
