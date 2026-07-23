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
        "You extract a single expense from the raw OCR text of a shopping "
        "receipt. The text may be noisy or misordered.\n\n"
        "Return ONLY a JSON object, no prose, no code fences, with keys:\n"
        '  "merchant": store/vendor name (short string),\n'
        '  "date": purchase date as "YYYY-MM-DD" (empty string if unknown),\n'
        '  "total": the grand total actually paid, as a number (no currency '
        "symbol, use a dot for decimals),\n"
        '  "currency": 3-letter code if visible else empty string,\n'
        '  "suggested_category": the best expense category for the whole '
        f"purchase. Prefer one of the user's existing categories: [{known}]. "
        "If none fit, propose a short new one.,\n"
        '  "confidence": your confidence in the total, 0.0 to 1.0.\n\n'
        "Pick the final/grand total, not subtotals or item prices. If several "
        "totals appear, choose the largest that is labelled as the total."
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
    match = re.search(r"\d{4}-\d{2}-\d{2}", str(value))
    return match.group(0) if match else date.today().isoformat()


def parse_receipt(text, resolved, category_names):
    """Ask the LLM to turn OCR text into a structured draft dict.

    `resolved` comes from llm.resolve_llm(). Raises ReceiptError on bad JSON.
    """
    system = _build_prompt(category_names)
    raw = get_chat_completion(resolved, system, text, max_tokens=400)
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
