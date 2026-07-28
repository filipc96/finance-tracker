import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Button from "../components/ui/Button";

const NotFound = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-100 px-4 text-center dark:bg-gray-900">
      <span className="text-7xl font-bold text-primary-600">404</span>
      <h1>{t("notFound.title")}</h1>
      <p className="max-w-md text-gray-500 dark:text-gray-400">
        {t("notFound.message")}
      </p>
      <Link to="/">
        <Button>{t("notFound.backToDashboard")}</Button>
      </Link>
    </div>
  );
};

export default NotFound;
