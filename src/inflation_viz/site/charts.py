"""Plotly figure builders. Every figure here is built from a polars
DataFrame passed in by the caller — no chart hardcodes data or looks up a
sources.yaml entry other than for its label/color, so anything that renders
traces straight back to the fetch pipeline.
"""

from __future__ import annotations

import plotly.graph_objects as go
import polars as pl

from inflation_viz.colors import CHART_SURFACE, GRIDLINE, HEADLINE_COLOR, MUTED_TEXT, division_color
from inflation_viz.config import SourceRegistry

_LAYOUT_DEFAULTS: dict[str, object] = {
    "paper_bgcolor": CHART_SURFACE.dark,
    "plot_bgcolor": CHART_SURFACE.dark,
    "font": {"family": "system-ui, -apple-system, 'Segoe UI', sans-serif", "color": "#ffffff"},
    "hovermode": "x unified",
    "hoverlabel": {
        "bgcolor": "#202020",
        "bordercolor": GRIDLINE.dark,
        "font": {"color": "#ffffff"},
    },
    "legend": {"orientation": "h", "yanchor": "bottom", "y": 1.02, "xanchor": "left", "x": 0},
    "margin": {"l": 48, "r": 24, "t": 48, "b": 40},
}

_AXIS_DEFAULTS: dict[str, object] = {
    "gridcolor": GRIDLINE.dark,
    "linecolor": MUTED_TEXT.dark,
    "tickfont": {"color": MUTED_TEXT.dark},
}


def _apply_layout(fig: go.Figure, *, title: str, yaxis_title: str) -> go.Figure:
    fig.update_layout(**_LAYOUT_DEFAULTS, title=title)
    fig.update_xaxes(**_AXIS_DEFAULTS)
    fig.update_yaxes(**_AXIS_DEFAULTS, title=yaxis_title, ticksuffix="%")
    return fig


def headline_chart(series: pl.DataFrame, registry: SourceRegistry) -> go.Figure:
    """CPI and CPIH 12-month rate, actuals only."""
    fig = go.Figure()
    for uid, source in registry.headline.items():
        s = series.filter(pl.col("unique_id") == uid).sort("ds")
        fig.add_trace(
            go.Scatter(
                x=s["ds"].to_list(),
                y=s["y"].to_list(),
                name=source.name,
                mode="lines",
                line={"width": 2, "color": HEADLINE_COLOR.dark if uid == "GB.CPI" else "#898781"},
                hovertemplate=f"{source.name}: %{{y:.1f}}%<extra></extra>",
            )
        )
    return _apply_layout(fig, title="UK headline inflation", yaxis_title="12-month rate")


def contributors_chart(series: pl.DataFrame, registry: SourceRegistry) -> go.Figure:
    """Stacked area of each division's ppt contribution to the headline CPI rate."""
    fig = go.Figure()
    for source in registry.divisions_sorted():
        s = series.filter(pl.col("unique_id") == source.unique_id).sort("ds")
        fig.add_trace(
            go.Scatter(
                x=s["ds"].to_list(),
                y=s["y"].to_list(),
                name=source.division_name,
                mode="lines",
                stackgroup="contributions",
                line={"width": 0.5, "color": division_color(source.unique_id, dark=True)},
                fillcolor=division_color(source.unique_id, dark=True),
                hovertemplate=f"{source.division_name}: %{{y:.2f}}ppt<extra></extra>",
            )
        )
    if "GB.CPI" in registry.headline:
        headline = series.filter(pl.col("unique_id") == "GB.CPI").sort("ds")
        fig.add_trace(
            go.Scatter(
                x=headline["ds"].to_list(),
                y=headline["y"].to_list(),
                name=registry.headline["GB.CPI"].name,
                mode="lines",
                line={"width": 2.5, "color": HEADLINE_COLOR.dark, "dash": "dot"},
                hovertemplate="Headline CPI: %{y:.1f}%<extra></extra>",
            )
        )
    return _apply_layout(
        fig, title="Contribution to headline CPI by division", yaxis_title="Percentage points"
    )


def basket_treemap(weights: pl.DataFrame, registry: SourceRegistry) -> go.Figure:
    """Treemap of the COICOP division weights, sized by basket share."""
    divisions = registry.divisions_sorted()
    weight_by_coicop = dict(
        zip(weights["coicop"].to_list(), weights["weight_per_mille"].to_list(), strict=True)
    )

    labels = [d.division_name for d in divisions]
    values = [weight_by_coicop.get(d.coicop, 0.0) for d in divisions]
    colors = [division_color(d.unique_id, dark=True) for d in divisions]

    fig = go.Figure(
        go.Treemap(
            labels=labels,
            parents=[""] * len(labels),
            values=values,
            marker={"colors": colors, "line": {"color": CHART_SURFACE.dark, "width": 2}},
            textinfo="label+percent root",
            hovertemplate="%{label}: %{value:.1f} per mille (%{percentRoot})<extra></extra>",
        )
    )
    fig.update_layout(**_LAYOUT_DEFAULTS, title="Current CPI basket weights by division")
    return fig
