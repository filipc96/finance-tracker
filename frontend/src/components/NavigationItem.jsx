import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { Link } from "react-router-dom";

const NavigationItem = ({ item }) => {
  return (
    <Link to={item?.link} className="flex items-center space-x-3">
      <FontAwesomeIcon icon={item?.icon} style={{ color: "gray" }} />
      <span>{item?.name}</span>
    </Link>
  );
};

export default NavigationItem;
