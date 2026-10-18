import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (import.meta.env.DEV) {
  const check = () => {
    const sw = document.documentElement.scrollWidth;
    const cw = document.documentElement.clientWidth;
    if (sw > cw) {
      console.warn(
        `[overflow] ${location.pathname} scrollWidth=${sw} > clientWidth=${cw} (overflow ${sw - cw}px)`,
      );
    }
  };
  let t: number | undefined;
  const schedule = () => {
    window.clearTimeout(t);
    t = window.setTimeout(check, 400);
  };
  window.addEventListener("popstate", schedule);
  window.addEventListener("resize", schedule);
  const origPush = history.pushState;
  history.pushState = function (...args) {
    const r = origPush.apply(this, args);
    schedule();
    return r;
  };
  schedule();
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Application root element #root is missing.");
}
createRoot(rootElement).render(<App />);
