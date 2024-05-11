import AddTransaction from "../components/AddTransaction";
import CategoryTable from "../components/CategoryTable";

const History = () => {
  return (
    <>
      <h2>History</h2>

      <div className="flex flex-col space-y-8 py-6 justify-center items-center">
        <div className="flex space-x-8 py-6">
          <AddTransaction type="expense"></AddTransaction>
          <AddTransaction type="income"></AddTransaction>
        </div>
        <div className="w-full">
          <CategoryTable categories={[]} />
        </div>{" "}
      </div>
    </>
  );
};

export default History;
