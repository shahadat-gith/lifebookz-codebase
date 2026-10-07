import { Routes, Route } from "react-router-dom";

import HandoffGate from "./components/HandoffGate";
import AccessDenied from "./components/AccessDenied";
import PaymentPage from "./pages/payment";
import PaymentSuccessPage from "./pages/paymentSuccess";
import PaymentFailurePage from "./pages/paymentFailure";

/**
 * Route table — clean, resource-generic URLs:
 *
 *  /pay/:for/:id           the checkout          /pay/consultation/<id>
 *  /pay/:for/:id/success   confirmation + redirect to the resource's portal
 *  /pay/:for/:id/failure   failure + retry
 *
 * `:for` names the payable resource (today "consultation"; new resources
 * use the same URL shape). Every page sits behind the gate: access denied
 * without a valid session, and the backend authorizes every payment call.
 */
export default function App() {
  return (
    <Routes>
      <Route
        path="/pay/:for/:id"
        element={
          <HandoffGate>
            <PaymentPage />
          </HandoffGate>
        }
      />
      <Route
        path="/pay/:for/:id/success"
        element={
          <HandoffGate>
            <PaymentSuccessPage />
          </HandoffGate>
        }
      />
      <Route
        path="/pay/:for/:id/failure"
        element={
          <HandoffGate>
            <PaymentFailurePage />
          </HandoffGate>
        }
      />
      <Route path="*" element={<AccessDenied />} />
    </Routes>
  );
}
