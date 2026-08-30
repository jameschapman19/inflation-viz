"""Single shared division color mapping, reused by every chart on the site.

Palette validated with the data-viz skill's `validate_palette.js`: all 12
hues clear the adjacent-pair CVD (ΔE >= 8) and normal-vision (ΔE >= 15) floors
in both light and dark mode. Three light-mode slots (CP03, CP04, CP05) sit
below 3:1 contrast against the chart surface — per the palette's "relief
rule" every chart carries a legend and direct hover labels, so identity is
never color-alone.

Do not add a per-chart color scale anywhere else in the codebase — import
DIVISION_COLORS (or the CSS custom properties in site/static/palette.css,
generated from the same table) instead.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class DivisionColor:
    light: str
    dark: str


# Keyed by unique_id (GB.CP01..GB.CP12), in fixed COICOP order. This order is
# the palette's validated adjacency order for a 12-series stacked area chart —
# do not re-sort it per chart.
DIVISION_COLORS: dict[str, DivisionColor] = {
    "GB.CP01": DivisionColor(light="#2a78d6", dark="#3987e5"),  # blue
    "GB.CP02": DivisionColor(light="#eb6834", dark="#d95926"),  # orange
    "GB.CP03": DivisionColor(light="#1baf7a", dark="#199e70"),  # aqua
    "GB.CP04": DivisionColor(light="#eda100", dark="#c98500"),  # yellow
    "GB.CP05": DivisionColor(light="#e87ba4", dark="#d55181"),  # magenta
    "GB.CP06": DivisionColor(light="#008300", dark="#008300"),  # green
    "GB.CP07": DivisionColor(light="#4a3aa7", dark="#9085e9"),  # violet
    "GB.CP08": DivisionColor(light="#e34948", dark="#e66767"),  # red
    "GB.CP09": DivisionColor(light="#009999", dark="#12a3a3"),  # teal
    "GB.CP10": DivisionColor(light="#b3691e", dark="#b56a1f"),  # amber
    "GB.CP11": DivisionColor(light="#c2185b", dark="#e0508a"),  # rose
    "GB.CP12": DivisionColor(light="#3f51b5", dark="#6f7fd4"),  # indigo
}

HEADLINE_COLOR = DivisionColor(light="#0b0b0b", dark="#ffffff")

# Chart chrome, from the data-viz skill's reference palette.
CHART_SURFACE = DivisionColor(light="#fcfcfb", dark="#1a1a19")
GRIDLINE = DivisionColor(light="#e1e0d9", dark="#2c2c2a")
MUTED_TEXT = DivisionColor(light="#898781", dark="#898781")


def division_color(unique_id: str, *, dark: bool = False) -> str:
    c = DIVISION_COLORS[unique_id]
    return c.dark if dark else c.light
