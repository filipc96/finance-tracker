"""Receipt scanning: local OCR + LLM extraction into an expense draft.

Pipeline: image bytes -> RapidOCR (local, offline) -> raw text -> the user's
configured text LLM -> strict-JSON draft {merchant, date, total, ...}. Nothing
is saved here; the view returns a draft the user reviews and confirms.

RapidOCR runs on onnxruntime (no torch) and ships its detection/recognition
models as package data, so the whole thing works offline inside the PyInstaller
sidecar once the models are bundled (see fintrax-server.spec).
"""

import io
import json
import re
from datetime import date
from decimal import Decimal, InvalidOperation

from .llm import get_chat_completion

_engine = None


class ReceiptError(Exception):
    """OCR produced no usable text, or the LLM output could not be parsed."""


def _get_engine():
    """Lazy singleton. First call loads the onnx models (~1-2s); cached after."""
    global _engine
    if _engine is None:
        from rapidocr_onnxruntime import RapidOCR

        _engine = RapidOCR()
    return _engine


def extract_text(image_bytes):
    """Run OCR on raw image bytes and return detected text, top-to-bottom.

    Raises ReceiptError if the image can't be decoded or has no readable text.
    """
    import numpy as np
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        image = Image.open(io.BytesIO(image_bytes))
        # Respect EXIF rotation from phone cameras; drop alpha for OCR.
        image = ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise ReceiptError("Could not read that image file.") from exc

    # Upscale small/low-res crops so small print (totals, dates) is legible to
    # the recognizer. Large phone photos are left alone.
    longest = max(image.size)
    if longest < 1600:
        scale = 1600 / longest
        new_size = (round(image.width * scale), round(image.height * scale))
        image = image.resize(new_size, Image.LANCZOS)

    engine = _get_engine()
    result, _elapsed = engine(np.asarray(image))
    if not result:
        raise ReceiptError(
            "No text found in the image. Try a clearer, well-lit photo."
        )

    # RapidOCR returns [box, text, score]; boxes come ordered top-to-bottom.
    lines = [str(item[1]).strip() for item in result if len(item) > 1]
    text = "\n".join(line for line in lines if line)
    if not text:
        raise ReceiptError(
            "No text found in the image. Try a clearer, well-lit photo."
        )
    return text


def _build_prompt(category_names):
    known = ", ".join(category_names) if category_names else "(none yet)"
    return (
        "You extract ONE expense from the raw OCR text of a shopping receipt. "
        "OCR is noisy: characters are often misread (0/O, 1/I/l, 5/S, 8/B, 6/G), "
        "lines can be out of order, and numbers may repeat.\n\n"
        "Follow these rules:\n"
        "- merchant: the store/vendor name, usually at the very top. Keep it "
        "short; drop addresses, tax/VAT IDs, and legal suffixes (d.o.o., LLC).\n"
        "- total: the FINAL amount actually paid. Choose the line explicitly "
        "labelled as the grand total. Total labels include: TOTAL, GRAND TOTAL, "
        "AMOUNT DUE, BALANCE DUE, UKUPNO, УКУПНО, ZA UPLATU, ЗА УПЛАТУ, IZNOS, "
        "SUMA. Never pick a subtotal, a single item price, tax/PDV/VAT, change, "
        "or 'cash tendered'/'gotovina'. If several totals tie, take the largest "
        "one labelled as a total.\n"
        "- numbers: receipts may use European formatting where '.' is the "
        "thousands separator and ',' is the decimal (1.234,56 means 1234.56). "
        "Output total as a plain number with a dot decimal, no thousands "
        "separators, no currency symbol.\n"
        "- currency: 3-letter ISO code if determinable (RSD, EUR, USD), else "
        "empty string. Serbian dinar receipts show 'дин', 'дин.', 'din', 'RSD'.\n"
        "- date: purchase date as YYYY-MM-DD. Receipts often print DD.MM.YYYY — "
        "convert it (day comes first). Empty string if no date is visible.\n"
        "- suggested_category: the best single category for the whole purchase. "
        "Strongly prefer an EXACT match (case-insensitive) from the user's "
        f"existing categories: [{known}]. Only invent a short new category if "
        "none reasonably fit.\n"
        "- confidence: 0.0-1.0, your confidence in the TOTAL specifically. Lower "
        "it when the OCR around the total looks garbled.\n\n"
        "Reason it through internally, but return ONLY a JSON object — no prose, "
        "no code fences — with exactly these keys: merchant, date, total, "
        "currency, suggested_category, confidence."
    )


def _strip_fences(text):
    text = text.strip()
    if text.startswith("```"):
        # ```json ... ```  ->  drop the first line and any trailing fence
        text = re.sub(r"^```[a-zA-Z]*\n", "", text)
        text = re.sub(r"\n```$", "", text.strip())
    return text.strip()


def _coerce_total(value):
    if value is None:
        return None
    try:
        # tolerate "1.234,56", "1,234.56", "€12.30", stray spaces
        cleaned = re.sub(r"[^\d.,]", "", str(value))
        if "," in cleaned and "." in cleaned:
            # last separator is the decimal one
            if cleaned.rfind(",") > cleaned.rfind("."):
                cleaned = cleaned.replace(".", "").replace(",", ".")
            else:
                cleaned = cleaned.replace(",", "")
        elif "," in cleaned:
            cleaned = cleaned.replace(",", ".")
        return Decimal(cleaned).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None


def _coerce_date(value):
    if not value:
        return date.today().isoformat()
    text = str(value).strip()
    # Already ISO (what the prompt asks for).
    match = re.search(r"\d{4}-\d{2}-\d{2}", text)
    if match:
        return match.group(0)
    # Fallback: European day-first formats the model may pass through
    # (DD.MM.YYYY, DD/MM/YY). User's receipts are Serbian → day comes first.
    match = re.search(r"(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})", text)
    if match:
        day, month, year = (int(g) for g in match.groups())
        if year < 100:
            year += 2000
        try:
            return date(year, month, day).isoformat()
        except ValueError:
            pass
    return date.today().isoformat()


def parse_receipt(text, resolved, category_names):
    """Ask the LLM to turn OCR text into a structured draft dict.

    `resolved` comes from llm.resolve_llm(). Raises ReceiptError on bad JSON.
    """
    system = _build_prompt(category_names)
    # Budget must clear the reasoning overhead of reasoning models (e.g.
    # gpt-5-mini spends ~250-400 tokens thinking before emitting the JSON);
    # too low and the whole budget goes to reasoning, leaving empty content.
    # temperature=0 makes extraction deterministic (ignored for reasoning
    # models, which reject it — see llm.get_chat_completion).
    raw = get_chat_completion(
        resolved, system, text, max_tokens=1500, temperature=0
    )
    if not raw or not raw.strip():
        raise ReceiptError(
            "The model returned an empty response. Try again, or pick a "
            "different model in Settings."
        )
    try:
        data = json.loads(_strip_fences(raw))
    except (json.JSONDecodeError, TypeError) as exc:
        raise ReceiptError(
            "The model did not return readable receipt data. Try again."
        ) from exc

    total = _coerce_total(data.get("total"))
    confidence = data.get("confidence")
    try:
        confidence = round(float(confidence), 2)
    except (TypeError, ValueError):
        confidence = None

    return {
        "merchant": (str(data.get("merchant") or "")).strip()[:255],
        "date": _coerce_date(data.get("date")),
        "total": str(total) if total is not None else "",
        "currency": (str(data.get("currency") or "")).strip()[:3].upper(),
        "suggested_category": (
            str(data.get("suggested_category") or "")
        ).strip()[:100],
        "confidence": confidence,
    }
