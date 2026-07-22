import { Link } from "react-router-dom";
import { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faLock, faWallet } from "@fortawesome/free-solid-svg-icons";
import Button from "./ui/Button";
import PasswordInput from "./ui/PasswordInput";

const Form = ({ route, method }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    setLoading(true);
    setErrorMsg("");
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
      const status = error.response?.status;
      if (status === 401) {
        setErrorMsg("Wrong username or password.");
      } else if (status === 400 && error.response?.data?.username) {
        setErrorMsg(error.response.data.username[0]);
      } else if (status === 400 && error.response?.data?.password) {
        setErrorMsg(error.response.data.password[0]);
      } else {
        setErrorMsg("Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl md:p-12">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="rounded-xl bg-black p-3">
            <FontAwesomeIcon icon={faWallet} className="text-2xl text-white" />
          </div>
          <span className="logo-text text-xl font-bold">Fintrax</span>
          <h2 className="!text-gray-900">
            {method == "login" ? "Welcome back" : "Create your account"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              Username
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <FontAwesomeIcon icon={faUser} className="text-gray-400" />
              </div>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-3.5 text-sm text-gray-900
                  placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                onChange={(e) => setUsername(e.target.value)}
                value={username}
                placeholder="Your username"
                required
              />
            </div>
          </div>

          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
          />

          {errorMsg && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorMsg}
            </p>
          )}

          <Button type="submit" isLoading={loading} className="w-full">
            {method == "login" ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          {method == "login" ? (
            <>
              {`Don't have an account? `}
              <Link
                to="/register"
                className="font-semibold text-primary-600 hover:text-primary-700"
              >
                Sign up for free
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-primary-600 hover:text-primary-700"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Form;
