const DashboardCard = ({ username, text, width, height }) => {
  return (
    <div
      className={`flex flex-col rounded-md border w-[${width}] h-[${height}] p-8 justify-center`}
    >
      <h2>{username}</h2>
      <p className="text-gray-500 mt-3">{text}</p>
    </div>
  );
};

export default DashboardCard;
