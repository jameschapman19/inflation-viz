from inflation_viz.colors import DIVISION_COLORS, division_color
from inflation_viz.config import SourceRegistry


def test_every_division_has_a_color(registry: SourceRegistry) -> None:
    for uid in registry.divisions:
        assert uid in DIVISION_COLORS, f"{uid} missing from the shared color config"


def test_colors_are_unique_hex_values() -> None:
    light_colors = [c.light for c in DIVISION_COLORS.values()]
    assert len(light_colors) == len(set(light_colors))
    for color in light_colors:
        assert color.startswith("#") and len(color) == 7


def test_dark_colors_are_unique_hex_values() -> None:
    dark_colors = [c.dark for c in DIVISION_COLORS.values()]
    assert len(dark_colors) == len(set(dark_colors))


def test_division_color_helper() -> None:
    assert division_color("GB.CP01") == DIVISION_COLORS["GB.CP01"].light
    assert division_color("GB.CP01", dark=True) == DIVISION_COLORS["GB.CP01"].dark
