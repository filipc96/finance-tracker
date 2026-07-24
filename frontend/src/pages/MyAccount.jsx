import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useCurrency } from "../contexts/CurrencyContext";

const MyAccount = () => {
  const { baseCurrency } = useCurrency();
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

  return (
    <>
      <h2>My Account</h2>

      <div className="flex flex-col gap-8 py-6 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              Base currency
            </div>
            <div className="text-lg font-semibold">{baseCurrency}</div>
            <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              Locked · set at signup
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
          <h3>Change password</h3>
          <Input
            type="password"
            placeholder="Current password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button type="submit" isLoading={saving} className="self-start">
            Change password
          </Button>
        </form>
      </div>
    </>
  );
};

export default MyAccount;
