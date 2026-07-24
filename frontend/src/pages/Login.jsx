import Form from "../components/Form";
import AccountPicker from "./AccountPicker";
import { isDesktop } from "../utils/desktop";

const Login = () => {
  // Desktop launches locked (fresh sidecar), so the logged-out landing is the
  // account picker; the web build keeps the plain login form.
  if (isDesktop()) {
    return <AccountPicker />;
  }
  return <Form route="/api/token/" method="login"></Form>;
};

export default Login;
