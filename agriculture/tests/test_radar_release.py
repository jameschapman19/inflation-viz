from pathlib import Path

from radar_contracts.artifacts import verify_bundle


def test_pinned_shared_packages_and_brand_assets() -> None:
    verify_bundle(Path(__file__).resolve().parents[1])
