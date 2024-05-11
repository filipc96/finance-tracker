import { faCalendar } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const DateInputBox = ({ value, onClick }) => {
  return (
    <div className="relative">
      <input
        type="text"
        name="date"
        id="date"
        className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
        required
        value={value}
        onClick={onClick}
        readOnly
      ></input>
      <div
        className="absolute inset-y-0 left-0 pl-3  
                    flex items-center  
                    pointer-events-none"
      >
        <FontAwesomeIcon icon={faCalendar} style={{ color: "gray" }} />
      </div>
    </div>
  );
};

export default DateInputBox;
