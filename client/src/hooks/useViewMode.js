import { useState } from "react";

export function useViewMode() {
  // Always default to 'table' (List mode). 
  // No localStorage persistence, so it never accidentally opens in grid mode.
  const [viewMode, setViewMode] = useState("table");

  return [viewMode, setViewMode];
}
