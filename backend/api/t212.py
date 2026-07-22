"""Thin Trading 212 public API (v0) client.

The API is beta and rate-limited to ~1 req/s per endpoint per account, so
callers must be cache-first (see StocksPortfolio view / PortfolioSnapshot).
"""

import base64

import requests

BASE_URLS = {
    "live": "https://live.trading212.com/api/v0",
    "demo": "https://demo.trading212.com/api/v0",
}


class T212Error(Exception):
    """Generic Trading 212 failure (timeouts, 5xx, connection errors)."""


class T212AuthError(T212Error):
    """Invalid or revoked API credentials (401/403)."""


class T212RateLimited(T212Error):
    """Per-endpoint rate limit hit (429)."""


class T212Client:
    def __init__(self, api_key, api_secret, environment="live", timeout=15):
        credentials = base64.b64encode(
            f"{api_key}:{api_secret}".encode()
        ).decode()
        self.base_url = BASE_URLS.get(environment, BASE_URLS["live"])
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Basic {credentials}"

    def _get(self, path):
        try:
            response = self.session.get(
                f"{self.base_url}{path}", timeout=self.timeout
            )
        except requests.RequestException as e:
            raise T212Error(f"Trading 212 request failed: {e}") from e

        if response.status_code in (401, 403):
            raise T212AuthError("Invalid Trading 212 credentials.")
        if response.status_code == 429:
            raise T212RateLimited("Trading 212 rate limit hit.")
        if not response.ok:
            raise T212Error(
                f"Trading 212 returned {response.status_code}."
            )
        return response.json()

    def get_positions(self):
        return self._get("/equity/positions")

    def get_cash(self):
        return self._get("/equity/account/cash")

    def get_summary(self):
        return self._get("/equity/account/summary")
