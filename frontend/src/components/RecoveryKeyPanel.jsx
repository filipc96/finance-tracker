import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faKey, faCopy, faCheck, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import Button from "./ui/Button";

// One-time display of an account's recovery key. The key is the ONLY way back
// into the encrypted secrets if the password is forgotten, and it is never
// shown again, so we require an explicit "I saved it" acknowledgement before
// continuing.
const RecoveryKeyPanel = ({ recoveryKey, onContinue }) => {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable; the key is selectable on screen anyway.
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="rounded-xl bg-primary-600 p-3">
          <FontAwesomeIcon icon={faKey} className="text-2xl text-white" />
        </div>
        <h2 className="!text-gray-900">Save your recovery key</h2>
        <p className="text-sm text-gray-500">
          This is the only way to regain access to your saved API keys if you
          forget your password. Store it somewhere safe — it won't be shown
          again.
        </p>
      </div>

      <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
        <code className="block break-all font-mono text-sm text-gray-900">
          {recoveryKey}
        </code>
      </div>

      <button
        type="button"
        onClick={copy}
        className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm
          font-medium text-gray-700 hover:bg-gray-50"
      >
        <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
        {copied ? "Copied" : "Copy to clipboard"}
      </button>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5"
        />
        <span className="flex items-center gap-1.5">
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="text-amber-500"
          />
          I have saved my recovery key somewhere safe.
        </span>
      </label>

      <Button
        type="button"
        onClick={onContinue}
        disabled={!acknowledged}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
};

export default RecoveryKeyPanel;
