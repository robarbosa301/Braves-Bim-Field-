import React from "react";
import ReactDOM from "react-dom/client";
import PranchetaBIM from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PranchetaBIM />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // updateViaCache: "none" stops the browser from ever satisfying the SW
    // script fetch itself from HTTP cache — without it, an already-cached
    // sw.js can make every future deploy invisible even though the site's
    // own network-first fetch logic is otherwise correct. The explicit
    // update() call forces an immediate check instead of waiting for the
    // browser's own (much longer) update heuristic.
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" })
      .then((reg) => reg.update());
  });
}
