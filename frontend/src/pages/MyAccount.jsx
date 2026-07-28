import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "../api";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useCurrency } from "../contexts/CurrencyContext";

const MyAccount = () => {
  const { t } = useTranslation();
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
      .catch(() => toast.error(t("myAccount.loadFailed")));
  }, []);

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t("myAccount.passwordMismatch"));
      return;
    }
    setSaving(true);
    api
      .post("/api/user/change-password/", {
        old_password: oldPassword,
        new_password: newPassword,
      })
      .then(() => {
        toast.success(t("myAccount.passwordChanged"));
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      })
      .catch((error) => {
        toast.error(
          error.response?.data?.error || t("myAccount.changeFailed")
        );
      })
      .finally(() => setSaving(false));
  };

  return (
    <>
      <h2>{t("myAccount.title")}</h2>

      <div className="flex flex-col gap-8 py-6 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t("myAccount.username")}
            </div>
            <div className="text-lg font-semibold">
              {user ? user.username : "…"}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t("myAccount.balance")}
            </div>
            <div className="text-lg font-semibold">
              {user ? user.balance : "…"}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t("myAccount.baseCurrency")}
            </div>
            <div className="text-lg font-semibold">{baseCurrency}</div>
            <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              {t("myAccount.locked")}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t("myAccount.memberSince")}
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
          <h3>{t("myAccount.changePassword")}</h3>
          <Input
            type="password"
            placeholder={t("myAccount.currentPassword")}
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder={t("myAccount.newPassword")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder={t("myAccount.confirmPassword")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button type="submit" isLoading={saving} className="self-start">
            {t("myAccount.changePassword")}
          </Button>
        </form>
      </div>
    </>
  );
};

export default MyAccount;
