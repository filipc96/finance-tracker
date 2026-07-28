import AddCategory from "../components/AddCategory";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "../api";
import CategoryTable from "../components/CategoryTable";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";

const Categories = () => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const getCategories = () => {
    api
      .get("/api/categories/")
      .then((response) => setCategories(response.data))
      .catch(() => toast.error(t("transaction.loadCategoriesFailed")));
  };

  const deleteCategory = (id) => {
    api
      .delete(`/api/categories/delete/${id}`)
      .then(() => {
        toast.success(t("categories.deleted"));
        getCategories();
      })
      .catch(() => toast.error(t("categories.deleteFailed")));
  };

  useEffect(() => {
    getCategories();
  }, []);

  // Client-side filter over the full list — the table then sorts what's left.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter(
      (c) =>
        (!typeFilter || c.type === typeFilter) &&
        (!q || c.name.toLowerCase().includes(q))
    );
  }, [categories, search, typeFilter]);

  return (
    <>
      <h2>{t("categories.title")}</h2>

      <div className="flex flex-col space-y-20 py-6 items-center justify-items-center">
        <AddCategory callback={getCategories}></AddCategory>
        <div className="w-full">
          <div className="flex flex-wrap items-end gap-3 pb-4">
            <Input
              label={t("history.search")}
              placeholder={t("history.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <Select
              label={t("history.type")}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-40"
            >
              <option value="">{t("history.allTypes")}</option>
              <option value="income">{t("chart.income")}</option>
              <option value="expense">{t("history.expense")}</option>
            </Select>
          </div>
          <CategoryTable categories={visible} onDelete={deleteCategory} />
        </div>
      </div>
    </>
  );
};

export default Categories;
