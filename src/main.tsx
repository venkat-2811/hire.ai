import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import logoIcon from "./assets/logo.png";

// Set favicon to the official Rekshift icon
const faviconEl = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
if (faviconEl) {
  faviconEl.type = "image/png";
  faviconEl.href = logoIcon;
}

createRoot(document.getElementById("root")!).render(<App />);
