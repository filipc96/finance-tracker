import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "../api";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Button from "./ui/Button";

const AddCategory = ({ callback }) => {
  const { t } = useTranslation();
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const addCategory = (e) => {
    e.preventDefault();
    if (categoryName && categoryType) {
      setIsSaving(true);
      api
        .post("/api/categories/", { name: categoryName, type: categoryType })
        .then(() => {
          toast.success(t("addCategory.created"));
          setCategoryName("");
          if (callback) callback();
        })
        .catch(() => toast.error(t("addCategory.createFailed")))
        .finally(() => setIsSaving(false));
    } else {
      toast.error(t("addCategory.emptyFields"));
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm w-full max-w-md h-auto p-6">
      <form onSubmit={addCategory} className="flex flex-col gap-4">
        <h3>{t("addCategory.title")}</h3>

        <Input
          label={t("addCategory.name")}
          type="text"
          placeholder={t("addCategory.namePlaceholder")}
          required
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
        />

        <Select
          label={t("addCategory.type")}
          value={categoryType}
          onChange={(e) => setCategoryType(e.target.value)}
        >
          <option value="">{t("addCategory.selectType")}</option>
          <option value="expense">{t("history.expense")}</option>
          <option value="income">{t("chart.income")}</option>
        </Select>

        <Button
          type="submit"
          variant="secondary"
          isLoading={isSaving}
          className="w-full mt-1"
        >
          {t("addCategory.title")}
        </Button>
      </form>
    </div>
  );
};

export default AddCategory;
