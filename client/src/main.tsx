import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handler to prevent unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Caught unhandled promise rejection:', event.reason);
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
