import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import AuthShell from "../../components/auth/AuthShell";
import AuthHeading from "../../components/auth/AuthHeading";
import AuthFooter from "../../components/auth/AuthFooter";
import FormError from "../../components/common/FormError";
import { Icons } from "../../icons";
import { apiError } from "../../utils/helpers";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Per-input messages: local checks plus any field the API rejected.
  const [fieldErrors, setFieldErrors] = useState({});
  const { registerUser } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError("");
      setFieldErrors({ password: "Password must be at least 8 characters." });
      return;
    }

    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      // Name, email and password only — the profile photo is chosen from
      // the dashboard later.
      await registerUser({ email, password, fullName });
      toast.success("Account created successfully!");
      navigate("/");
    } catch (err) {
      const { message, fields } = apiError(
        err,
        "Registration failed. Please try again.",
      );

      // Field-level failures read best under the input they belong to; the
      // banner is left for failures that are not about one field.
      const hasFields = Object.keys(fields).length > 0;
      setFieldErrors(fields);
      setError(hasFields ? "" : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthHeading
        title="Create your account"
        subtitle="Join the community of readers and storytellers."
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Enter your full name"
          required
          error={fieldErrors.fullName}
          icon={<Icons.user className="h-4 w-4" />}
        />

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          error={fieldErrors.email}
          icon={<Icons.mail className="h-4 w-4" />}
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
          required
          error={fieldErrors.password}
          helperText="Use at least 8 characters."
          icon={<Icons.lock className="h-4 w-4" />}
          showPasswordToggle
        />

        <FormError>{error}</FormError>

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={loading}
          className="font-semibold !rounded-xl"
          icon={<Icons.userAdd className="h-4 w-4" />}
        >
          Create Account
        </Button>
      </form>

      <AuthFooter
        prompt="Already have an account?"
        linkLabel="Sign in"
        to="/login"
      />
    </AuthShell>
  );
}
