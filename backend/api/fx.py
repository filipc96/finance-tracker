"""Currency conversion into the app's base currency.

Trading 212 reports the portfolio in its own account currency (e.g. USD),
while the rest of the app is denominated in RSD. To sum a portfolio into net
worth we convert it here, using a free no-key FX API cached once per day per
currency pair (see ExchangeRate).
"""

from datetime import date
from decimal import Decimal

import requests

from .models import ExchangeRate

# Base currency the whole app is denominated in (matches the frontend's
# DEFAULT_CURRENCY). Kept here as the single backend source of truth.
BASE_CURRENCY = "RSD"

# open.er-api.com: free, no API key, returns {"result":"success","rates":{...}}
_FX_URL = "https://open.er-api.com/v6/latest/{base}"
_FX_TIMEOUT = 10


class FxError(Exception):
    """FX rate could not be resolved (network failure, unknown currency)."""


def get_rate(base, quote, on=None):
    """Return the base->quote rate as a Decimal.

    Same-currency is 1. Cached per day in ExchangeRate; on a cache miss the
    rate is fetched and stored. If the network fetch fails, falls back to the
    most recent cached rate for the pair; if none exists, raises FxError.
    """
    base = (base or BASE_CURRENCY).upper()
    quote = (quote or BASE_CURRENCY).upper()
    if base == quote:
        return Decimal("1")

    on = on or date.today()

    cached = ExchangeRate.objects.filter(
        base=base, quote=quote, date=on
    ).first()
    if cached:
        return cached.rate

    try:
        response = requests.get(_FX_URL.format(base=base), timeout=_FX_TIMEOUT)
        response.raise_for_status()
        data = response.json()
        if data.get("result") != "success":
            raise FxError(f"FX API error for {base}: {data.get('error-type')}")
        raw = data.get("rates", {}).get(quote)
        if raw is None:
            raise FxError(f"No {base}->{quote} rate available.")
        rate = Decimal(str(raw))
    except (requests.RequestException, ValueError, KeyError) as e:
        # Network / parse failure — reuse the last known rate if we have one.
        last = (
            ExchangeRate.objects.filter(base=base, quote=quote)
            .order_by("-date")
            .first()
        )
        if last:
            return last.rate
        raise FxError(f"Could not fetch {base}->{quote} rate: {e}") from e

    ExchangeRate.objects.update_or_create(
        base=base, quote=quote, date=on, defaults={"rate": rate}
    )
    return rate


def to_base(amount, currency, on=None):
    """Convert `amount` in `currency` into BASE_CURRENCY, rounded to cents.

    Returns (base_value: Decimal, rate: Decimal). Raises FxError on failure.
    """
    rate = get_rate(currency, BASE_CURRENCY, on=on)
    value = (Decimal(str(amount)) * rate).quantize(Decimal("0.01"))
    return value, rate
