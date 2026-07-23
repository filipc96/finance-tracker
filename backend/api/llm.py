"""Multi-provider LLM layer for chat.

Pattern ported from the youtube-transcript project's llm_providers.py:
a PROVIDERS config dict + factory. OpenAI, Ollama and LM Studio all speak
the OpenAI-compatible API (only base_url differs); Anthropic uses its own
SDK. Configuration is per-user (Settings model), not env vars.
"""

import anthropic as anthropic_sdk
import openai as openai_sdk
import requests
from openai import OpenAI

DEFAULT_PROVIDER = "openai"

PROVIDERS = {
    "openai": {
        "label": "OpenAI",
        "kind": "openai_compat",
        "needs_key": True,
        "key_field": "open_ai_api_key",
        "default_model": "gpt-5-mini",
        "static_models": ["gpt-5-mini", "gpt-4o-mini", "gpt-4o"],
    },
    "anthropic": {
        "label": "Anthropic",
        "kind": "anthropic",
        "needs_key": True,
        "key_field": "anthropic_api_key",
        "default_model": "claude-sonnet-4-6",
        "static_models": [
            "claude-sonnet-4-6",
            "claude-opus-4-6",
            "claude-haiku-4-5",
        ],
    },
    "ollama": {
        "label": "Ollama",
        "kind": "openai_compat",
        "needs_key": False,
        "dummy_key": "ollama",
        "base_url_field": "ollama_base_url",
        "default_base_url": "http://localhost:11434/v1",
        "default_model": None,
    },
    "lmstudio": {
        "label": "LM Studio",
        "kind": "openai_compat",
        "needs_key": False,
        "dummy_key": "lm-studio",
        "base_url_field": "lmstudio_base_url",
        "default_base_url": "http://localhost:1234/v1",
        "default_model": None,
    },
}


class LLMError(Exception):
    """Generic LLM failure."""


class LLMConfigError(LLMError):
    """Missing/invalid user configuration (provider, key, model)."""


class LLMAuthError(LLMError):
    """Provider rejected the API key."""


class LLMRateLimitError(LLMError):
    """Provider rate limit hit."""


class LLMConnectionError(LLMError):
    """Could not reach the provider (mostly local servers not running)."""


def _base_url(settings, cfg):
    if "base_url_field" not in cfg:
        return None
    return getattr(settings, cfg["base_url_field"]) or cfg["default_base_url"]


def resolve_llm(settings, provider=None, model=None):
    """Resolve provider/model/credentials from request overrides + Settings.

    Returns a dict {provider, label, kind, model, api_key, base_url}.
    """
    provider = provider or settings.llm_provider or DEFAULT_PROVIDER
    if provider not in PROVIDERS:
        raise LLMConfigError(f"Unknown LLM provider '{provider}'.")
    cfg = PROVIDERS[provider]

    if cfg["needs_key"]:
        api_key = getattr(settings, cfg["key_field"])
        if not api_key:
            raise LLMConfigError(
                f"No {cfg['label']} API key configured. "
                "Add one on the Settings page."
            )
    else:
        api_key = cfg["dummy_key"]

    resolved_model = model or settings.llm_model or cfg["default_model"]
    if not resolved_model:
        raise LLMConfigError(
            f"Choose a model for {cfg['label']} in Settings or the chat header."
        )

    return {
        "provider": provider,
        "label": cfg["label"],
        "kind": cfg["kind"],
        "model": resolved_model,
        "api_key": api_key,
        "base_url": _base_url(settings, cfg),
    }


def get_chat_completion(resolved, system, message, max_tokens=1500, temperature=None):
    """Send one chat turn and return the response text.

    Default budget is generous because reasoning models (e.g. gpt-5-mini)
    spend part of the completion budget on hidden reasoning tokens; too small
    a budget can leave nothing for the visible answer.

    `temperature` is optional: pass 0 for deterministic structured extraction
    (receipt parsing). It is omitted for OpenAI reasoning models, which only
    accept the default temperature and 400 on anything else.
    """
    if resolved["kind"] == "anthropic":
        return _anthropic_completion(
            resolved, system, message, max_tokens, temperature
        )
    return _openai_compat_completion(
        resolved, system, message, max_tokens, temperature
    )


# OpenAI reasoning families reject sampling params like `temperature`; they
# only run at the default. Matched by model-name prefix.
_OPENAI_REASONING_PREFIXES = ("gpt-5", "o1", "o3", "o4")


def _is_openai_reasoning(model):
    name = (model or "").lower()
    return any(name.startswith(prefix) for prefix in _OPENAI_REASONING_PREFIXES)


def _connection_error(resolved):
    if resolved["base_url"]:
        return LLMConnectionError(
            f"Could not connect to {resolved['label']} at "
            f"{resolved['base_url']}. Is it running?"
        )
    return LLMConnectionError(
        f"Could not reach {resolved['label']}. Try again later."
    )


def _openai_compat_completion(resolved, system, message, max_tokens, temperature=None):
    client = OpenAI(
        api_key=resolved["api_key"],
        base_url=resolved["base_url"],
        timeout=60,
    )
    # OpenAI's GPT-5+ models reject `max_tokens` and require
    # `max_completion_tokens`. Local OpenAI-compatible servers (Ollama,
    # LM Studio) only understand the older `max_tokens`, so branch on provider.
    if resolved["provider"] == "openai":
        token_kwargs = {"max_completion_tokens": max_tokens}
    else:
        token_kwargs = {"max_tokens": max_tokens}
    # Only pass temperature where it's accepted: OpenAI reasoning models reject
    # it, everything else (gpt-4o*, Ollama, LM Studio) honours it.
    if temperature is not None and not (
        resolved["provider"] == "openai"
        and _is_openai_reasoning(resolved["model"])
    ):
        token_kwargs["temperature"] = temperature
    try:
        completion = client.chat.completions.create(
            model=resolved["model"],
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": message},
            ],
            **token_kwargs,
        )
        return completion.choices[0].message.content
    except openai_sdk.AuthenticationError as e:
        raise LLMAuthError(str(e)) from e
    except openai_sdk.RateLimitError as e:
        raise LLMRateLimitError(str(e)) from e
    except openai_sdk.APIConnectionError as e:
        raise _connection_error(resolved) from e
    except openai_sdk.OpenAIError as e:
        raise LLMError(str(e)) from e


def _anthropic_completion(resolved, system, message, max_tokens, temperature=None):
    client = anthropic_sdk.Anthropic(api_key=resolved["api_key"], timeout=60)
    extra = {} if temperature is None else {"temperature": temperature}
    try:
        response = client.messages.create(
            model=resolved["model"],
            system=system,
            messages=[{"role": "user", "content": message}],
            max_tokens=max_tokens,
            **extra,
        )
        return "".join(
            block.text for block in response.content if block.type == "text"
        )
    except anthropic_sdk.AuthenticationError as e:
        raise LLMAuthError(str(e)) from e
    except anthropic_sdk.RateLimitError as e:
        raise LLMRateLimitError(str(e)) from e
    except anthropic_sdk.APIConnectionError as e:
        raise _connection_error(resolved) from e
    except anthropic_sdk.AnthropicError as e:
        raise LLMError(str(e)) from e


def _list_local_models(base_url):
    """OpenAI-compatible /models listing for Ollama / LM Studio."""
    response = requests.get(f"{base_url}/models", timeout=2)
    response.raise_for_status()
    return [m["id"] for m in response.json().get("data", [])]


def list_providers(settings):
    """Provider metadata for the chat-header switcher / Settings page."""
    result = []
    for name, cfg in PROVIDERS.items():
        entry = {
            "name": name,
            "label": cfg["label"],
            "kind": cfg["kind"],
            "default_model": cfg["default_model"],
            "models": list(cfg.get("static_models", [])),
            "configured": True,
            "error": None,
        }
        if cfg["needs_key"]:
            entry["configured"] = bool(getattr(settings, cfg["key_field"]))
        else:
            base_url = _base_url(settings, cfg)
            try:
                entry["models"] = _list_local_models(base_url)
            except requests.RequestException:
                entry["models"] = []
                entry["error"] = (
                    f"{cfg['label']} not reachable at {base_url}."
                )
        result.append(entry)
    return result
