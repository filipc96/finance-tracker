import { Link } from "react-router-dom";
import { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants";

const Form = ({ route, method }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    setLoading(true);
    e.preventDefault();

    try {
      const res = await api.post(route, { username, password });
      if (method == "login") {
        localStorage.setItem(ACCESS_TOKEN, res.data.access);
        localStorage.setItem(REFRESH_TOKEN, res.data.refresh);
        navigate("/");
      } else {
        navigate("/login");
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="relative flex flex-col m-6 space-y-8 bg-white shadow-2xl rounded-2xl md:flex-row md:space-y-0">
        <div className="flex flex-col justify-center p-8 md:p-14">
          <span className="mb-3 text-4xl text-center font-bold">
            {method == "login" ? "Login" : "Register"}
          </span>
          <form onSubmit={handleSubmit}>
            <div className="py-4">
              <span className="mb-2 text-md">Username</span>
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md placeholder:font-light placeholder:text-gray-500"
                onChange={(e) => setUsername(e.target.value)}
                value={username}
              />
            </div>
            <div className="py-4">
              <span className="mb-2 text-md">Password</span>
              <input
                type="password"
                className="w-full p-2 border border-gray-300 rounded-md placeholder:font-light placeholder:text-gray-500"
                onChange={(e) => setPassword(e.target.value)}
                value={password}
              />
            </div>
            <div className="flex justify-between w-full py-4">
              <div className="mr-24">
                <input type="checkbox" name="ch" id="ch" className="mr-2" />
                <span className="text-md">Remember for 30 days</span>
              </div>
              <span className="font-bold text-md">Forgot password</span>
            </div>
            <button
              type="submit"
              className="w-full bg-black text-white p-2 rounded-lg mb-6 hover:bg-white hover:text-black hover:border hover:border-gray-300"
            >
              Sign in
            </button>
          </form>
          {method == "login" ? (
            <div className="text-center text-gray-400">
              {`Don't have an account? `}
              <Link to="/register" className="font-bold text-black">
                Sign up for free
              </Link>
            </div>
          ) : (
            <div className="text-center text-gray-400">
              Already have an account?{" "}
              <Link to="/login" className="font-bold text-black">
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Form;
