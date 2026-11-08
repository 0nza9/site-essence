"use client";

import { useEffect, useState } from "react";

type Choice = "system" | "light" | "dark";

const STORAGE_KEY = "fuelmap-theme";

/** Clair / sombre. Tant qu'on choisit rien, c'est le système qui décide. */
export default function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");

  // pas de localStorage côté serveur, donc on lit après l'hydratation
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") setChoice(stored);
    } catch {
      // navigation privée ou stockage bloqué : tant pis, on reste sur « system »
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);

    try {
      if (choice === "system") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // sans stockage le choix saute au rechargement, pas grave
    }
  }, [choice]);

  const next: Choice = choice === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm btn-circle"
      onClick={() => setChoice(next)}
      title={next === "dark" ? "Thème sombre" : "Thème clair"}
      aria-label={next === "dark" ? "Passer au thème sombre" : "Passer au thème clair"}
    >
      <span aria-hidden="true">{choice === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
