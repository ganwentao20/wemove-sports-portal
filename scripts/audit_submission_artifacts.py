"""Check the approved Office deliverables for stale project-direction wording."""
from __future__ import annotations

import re
import zipfile
from pathlib import Path

from generate_submission_manifest import DELIVERABLES, FILES


FORBIDDEN = ("WEMOVE SPORTS", "运动产品门户", "运动游戏玩具")


def office_text(path: Path) -> str:
    with zipfile.ZipFile(path) as package:
        xml = "\n".join(
            package.read(name).decode("utf-8", errors="ignore")
            for name in package.namelist()
            if name.endswith(".xml")
        )
    return re.sub(r"<[^>]+>", "", xml)


def main() -> None:
    checked = 0
    findings = []
    for name, kind, _, _ in FILES:
        if kind not in {"DOCX", "PPTX"}:
            continue
        checked += 1
        path = DELIVERABLES / name
        text = office_text(path)
        for phrase in FORBIDDEN:
            if phrase in text:
                findings.append(f"{name}: {phrase}")
    if findings:
        raise SystemExit("\n".join(findings))
    print(f"PASS: {checked} Office files; no stale direction wording")


if __name__ == "__main__":
    main()
