import { lazy, Suspense } from "react";
import App from "./App";
const PlatformPortal = lazy(() => import("./platform/Portal"));
export default function Root() {
  return window.location.pathname.split("/").filter(Boolean)[0] ===
    "platform-admin" ? (
    <Suspense fallback={<p>Loading owner portal…</p>}>
      <PlatformPortal />
    </Suspense>
  ) : (
    <App />
  );
}
