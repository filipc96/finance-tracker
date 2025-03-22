import ToggleButton from "../components/ToggleButton";

const Settings = () => {
  return (
    <div className="flex flex-col space-y-6">
      <h2 className="text-2xl font-bold dark:text-white">Settings</h2>

      <div className="flex flex-col space-y-4 p-6 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 max-w-md">
        <div className="flex justify-between items-center">
          <span className="text-gray-700 dark:text-gray-200">Dark Mode</span>
          <ToggleButton />
        </div>
      </div>
    </div>
  );
};

export default Settings;
