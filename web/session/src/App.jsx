import { Routes, Route } from "react-router-dom";

import HandoffGate from "./components/HandoffGate";
import AccessDenied from "./components/AccessDenied";
import MeetingPage from "./pages/meeting";
import RatingPage from "./pages/rating";

/**
 * Route table — this portal is the meeting room, nothing else.
 *
 *  /session/:consultationId → the live room
 *  /rating/:consultationId  → the client's post-meeting rating
 *
 * Portals open these URLs with a one-time ticket in the URL hash; the gate
 * exchanges it in the background and strips it from the URL. The URL alone
 * never grants access: access denied without a valid session, and the
 * backend re-authorizes every page load anyway.
 */
export default function App() {
  return (
    <Routes>
      <Route
        path="/session/:consultationId"
        element={
          <HandoffGate>
            <MeetingPage />
          </HandoffGate>
        }
      />
      <Route
        path="/rating/:consultationId"
        element={
          <HandoffGate>
            <RatingPage />
          </HandoffGate>
        }
      />
      <Route path="*" element={<AccessDenied />} />
    </Routes>
  );
}
