import { describe, it, expect, beforeEach } from "vitest";
import {
  formatMoney,
  formatWhole,
  formatAmount,
  setActiveBase,
  setActiveDisplay,
  getActiveBase,
  getActiveDisplayCurrency,
  getActiveDisplayRate,
  CURRENCY_SYMBOLS,
  CURRENCY_OPTIONS,
} from "./formatCurrency";

// Mirror the helper's own grouping so assertions verify symbol placement, rate
// conversion, and fraction handling without hardcoding a locale's separators.
const grouped2 = (n) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

describe("formatMoney", () => {
  it("prefixes a known symbol and applies 2 decimals", () => {
    expect(formatMoney(1234.56, "USD", 1)).toBe("$" + grouped2(1234.56));
  });

  it("falls back to an ISO-code suffix for symbol-less currencies", () => {
    const out = formatMoney(1000, "RSD", 1);
    expect(out.startsWith("$")).toBe(false);
    expect(out.endsWith(" RSD")).toBe(true);
  });

  it("converts a base amount into the display currency by the rate", () => {
    expect(formatMoney(100, "USD", 2)).toBe("$" + grouped2(200));
  });

  it("treats a non-positive or invalid rate as 1", () => {
    expect(formatMoney(100, "USD", 0)).toBe(formatMoney(100, "USD", 1));
    expect(formatMoney(100, "USD", "nope")).toBe(formatMoney(100, "USD", 1));
  });

  it("returns an em dash for non-numeric input", () => {
    expect(formatMoney(undefined, "USD", 1)).toBe("—");
    expect(formatMoney("abc", "USD", 1)).toBe("—");
  });

  it("coerces null to zero (JS Number(null) === 0), not an em dash", () => {
    expect(formatMoney(null, "USD", 1)).toBe("$" + grouped2(0));
  });
});

describe("formatWhole", () => {
  it("rounds to whole units with the symbol prefix", () => {
    expect(formatWhole(1234.56, "USD", 1)).toBe("$" + (1235).toLocaleString());
  });

  it("uses the ISO-code suffix for symbol-less currencies", () => {
    expect(formatWhole(1000.4, "RSD", 1)).toBe((1000).toLocaleString() + " RSD");
  });

  it("applies the rate before rounding", () => {
    expect(formatWhole(100, "USD", 2.5)).toBe("$" + (250).toLocaleString());
  });

  it("returns an em dash for non-numeric input", () => {
    expect(formatWhole(undefined, "USD", 1)).toBe("—");
  });
});

describe("formatAmount", () => {
  it("renders a bare, currency-less 2-decimal number", () => {
    expect(formatAmount(1234.5)).toBe("1234.50");
    expect(formatAmount("40")).toBe("40.00");
  });

  it("returns an em dash for undefined / non-numeric", () => {
    expect(formatAmount(undefined)).toBe("—");
    expect(formatAmount("nope")).toBe("—");
  });
});

describe("active display state", () => {
  beforeEach(() => {
    setActiveBase("USD");
    setActiveDisplay("USD", 1);
  });

  it("backs the module defaults used by formatMoney() with no explicit args", () => {
    setActiveDisplay("EUR", 0.5);
    expect(getActiveDisplayCurrency()).toBe("EUR");
    expect(getActiveDisplayRate()).toBe(0.5);
    expect(formatMoney(100)).toBe("€" + grouped2(50));
  });

  it("clamps a non-positive or invalid rate to 1", () => {
    setActiveDisplay("EUR", -3);
    expect(getActiveDisplayRate()).toBe(1);
    setActiveDisplay("EUR", "nan");
    expect(getActiveDisplayRate()).toBe(1);
  });

  it("ignores an empty currency or base but still applies a valid rate", () => {
    setActiveDisplay("", 2);
    expect(getActiveDisplayCurrency()).toBe("USD"); // unchanged
    expect(getActiveDisplayRate()).toBe(2);
    setActiveBase("");
    expect(getActiveBase()).toBe("USD"); // unchanged
  });
});

describe("currency metadata", () => {
  it("offers RSD in the picker but leaves it symbol-less (code fallback)", () => {
    expect(CURRENCY_OPTIONS.some((o) => o.code === "RSD")).toBe(true);
    expect(CURRENCY_SYMBOLS.RSD).toBeUndefined();
    expect(CURRENCY_SYMBOLS.USD).toBe("$");
  });
});
