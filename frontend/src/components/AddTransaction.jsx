import { useEffect, useState } from "react";
import api from "../api";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import DateInputBox from "./DateInputBox";
import { format } from "date-fns";

const AddTransaction = ({ type, callback }) => {
  const [categories, setCategories] = useState([]);
  const [date, setDate] = useState(new Date());
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState(0);
  const [name, setName] = useState("");

  useEffect(() => {
    api
      .get("/api/categories/")
      .then((response) => setCategories(response.data))
      .catch((error) =>
        console.error("Error fetching the categories: ", error)
      );
  }, []);

  const getCategories = categories
    .filter((category) => category.type === type)
    .map((category) => {
      return (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      );
    });

  const addTransaction = (e) => {
    e.preventDefault();

    if (date && name && amount && category) {
      console.log(name);
      api
        .post("/api/transactions/", {
          name: name,
          type: type,
          date: date,
          amount: amount,
          category: category,
        })
        .then((res) => {
          if (res.status === 201) console.log("Transaction created!");
          else console.log("Failed to create transaction!");

          if (callback) callback();
        })
        .catch((error) => console.log(error));
    } else {
      console.log("You can't leave the fields empty!");
    }
  };
  return (
    <div
      className={`flex flex-col rounded-md border w-96 h-auto p-8 justify-center items-center`}
    >
      <form onSubmit={addTransaction}>
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
          <h2>Add {type == "expense" ? "Expense" : "Income"}</h2>
          <div className="sm:col-span-2">
            <label
              htmlFor="name"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              Short Description
            </label>
            <input
              type="text"
              name="name"
              id="name"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
              placeholder="Type short description"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="w-full">
            <label
              htmlFor="price"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              Amount
            </label>
            <input
              type="number"
              name="price"
              id="price"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
              placeholder="$1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="category"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              Category
            </label>
            <select
              id="category"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option defaultValue="">Select category</option>
              {getCategories}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="name"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              Date{" "}
            </label>
            <DatePicker
              selected={date}
              onChange={(date) => {
                let formatedDate = format(date, "yyyy-MM-dd");
                setDate(formatedDate);
                console.log(formatedDate);
              }}
              customInput={<DateInputBox></DateInputBox>}
            />
          </div>
        </div>

        <button
          type="submit"
          value="Submit"
          className="w-full mt-5 bg-black text-white p-2 rounded-lg hover:bg-white hover:text-black hover:border hover:border-gray-300"
        >
          Add {type === "expense" ? "Expense" : "Income"}
        </button>
      </form>
    </div>
  );
};

export default AddTransaction;
