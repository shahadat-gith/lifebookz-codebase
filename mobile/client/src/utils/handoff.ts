/**
 * Cross-portal handoff, mobile edition.
 *
 * Live sessions and checkout live on their own portals. The mobile app
 * trades its JWT for a one-time ticket (POST /consultations/handoff) and
 * opens the portal in the system browser with the ticket in the URL hash —
 * the same credential system the web client uses, nothing new is trusted.
 *
 * Every portal URL carries `?platform=mobile`: the session room uses it to
 * send the user BACK into the app for rating when the meeting ends (the
 * web rating page is never shown), and the payment portal forwards it to
 * the session room it opens after checkout.
 */
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import api from "../config/api";
import { TOKEN_KEY } from "../config/api";

async function mintTicket(): Promise<string> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) throw new Error("No active session to hand off.");

  const res = await api.post("/consultations/handoff");
  return res.data.data.code;
}

function portalBase(envValue?: string) {
  return (envValue || "").replace(/\/$/, "");
}

/** Open the payment portal for a resource (e.g. "consultation").
 *  The app's scheme rides along (`?src=`) so the payment portal can
 *  forward it to the session room it opens after checkout — keeping the
 *  return-to-app rating flow intact across the whole journey.
 */
export async function openPayment(resource: string, resourceId: string) {
  const paymentBase = portalBase(process.env.EXPO_PUBLIC_PAYMENT_URL);
  if (!paymentBase) {
    throw new Error("The payment portal isn't configured (EXPO_PUBLIC_PAYMENT_URL missing).");
  }

  const code = await mintTicket();
  await WebBrowser.openBrowserAsync(
    `${paymentBase}/pay/${encodeURIComponent(resource)}/${encodeURIComponent(
      resourceId,
    )}?platform=mobile#tk=${code}`,
  );
}

/** Open the live session room for a consultation. */
export async function openConsultation(consultationId: string) {
  const sessionBase = portalBase(process.env.EXPO_PUBLIC_SESSION_URL);
  if (!sessionBase) {
    throw new Error("The session portal isn't configured (EXPO_PUBLIC_SESSION_URL missing).");
  }

  const code = await mintTicket();
  await WebBrowser.openBrowserAsync(
    `${sessionBase}/session/${encodeURIComponent(consultationId)}?platform=mobile#tk=${code}`,
  );
}
