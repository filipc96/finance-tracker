import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api";

const MyAccount = () => {
  const [user, setUser] = useState(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/api/user/")
      .then((res) => setUser(res.data))
      .catch(() => toast.error("Failed to load account info."));
  }, []);

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setSaving(true);
    api
      .post("/api/user/change-password/", {
        old_password: oldPassword,
        new_password: newPassword,
      })
      .then(() => {
        toast.success("Password changed successfully.");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      })
      .catch((error) => {
        toast.error(
          error.response?.data?.error || "Failed to change password."
        );
      })
      .finally(() => setSaving(false));
  };

  const inputClass =
    "w-full px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:border-blue-500";

  return (
    <>
      <h2>My Account</h2>

      <div className="flex flex-col gap-8 py-6 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Username
            </div>
            <div className="text-lg font-semibold">
              {user ? user.username : "…"}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Balance
            </div>
            <div className="text-lg font-semibold">
              {user ? user.balance : "…"}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Member since
            </div>
            <div className="text-lg font-semibold">
              {user ? user.date_joined : "…"}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleChangePassword}
          className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
        >
          <h3 className="font-semibold">Change password</h3>
          <input
            type="password"
            placeholder="Current password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className={inputClass}
            required
          />
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="self-start px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Change password"}
          </button>
        </form>
      </div>
    </>
  );
};

export default MyAccount;
