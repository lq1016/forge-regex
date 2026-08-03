import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const el = document.getElementById("forge-regex-root");
if (el) {
  createRoot(el).render(<App />);
}
