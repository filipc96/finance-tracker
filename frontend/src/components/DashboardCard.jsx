const DashboardCard = ({ username, text }) => {
  return (
    <div
      className={`flex flex-col rounded-md border w-96 h-auto p-8 justify-center`}
    >
      <h2>{username}</h2>
      <p className="text-gray-500 mt-3" style={{ whiteSpace: "pre-line" }}>
        {text}
      </p>
    </div>
  );
};

export default DashboardCard;
