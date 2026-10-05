"""Verify vendored releases and generated brand assets without network access."""

from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path


def verify_bundle(root: Path) -> None:
    manifest = json.loads((root / "vendor/radar-packages.json").read_text())
    for release in manifest["packages"]:
        wheel = root / "vendor" / release["file"]
        if hashlib.sha256(wheel.read_bytes()).hexdigest() != release["sha256"]:
            raise ValueError(f"Pinned Radar package changed: {wheel.name}")
        with zipfile.ZipFile(wheel) as archive:
            for target, source in release.get("assets", {}).items():
                if (root / target).read_bytes() != archive.read(source):
                    raise ValueError(f"Radar brand asset drift: {target}")
            directory = release.get("sourceDirectory")
            if directory:
                source_root = root / directory
                for source in source_root.rglob("*"):
                    if source.is_file() and "__pycache__" not in source.parts:
                        relative = source.relative_to(source_root).as_posix()
                        if source.read_bytes() != archive.read(relative):
                            raise ValueError(f"Radar release differs from source: {relative}")
