"""Shared HTTP session for talking to ons.gov.uk — retries a 429 (rate
limited) or transient 5xx with backoff, honouring a `Retry-After` header
when ONS sends one, instead of failing the whole refresh on one throttle.
"""

from __future__ import annotations

import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

_RETRY = Retry(
    total=5,
    backoff_factor=2.0,
    status_forcelist=[429, 500, 502, 503, 504],
    respect_retry_after_header=True,
)


def new_session() -> requests.Session:
    session = requests.Session()
    adapter = HTTPAdapter(max_retries=_RETRY)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session
