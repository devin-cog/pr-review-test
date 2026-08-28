import React from "react";

const ENV = import.meta.env.VITE_ENV ?? "staging";

export function StatusPill() {
  return (
    <span
      style={{
        display: "inline-flex",
        borderRadius: 999,
        background: "#e8f5e9",
        color: "#1b5e20",
        fontFamily: "sans-serif",
        fontWeight: 600,
        padding: "8px 14px",
      }}
    >
      Preview environment: {ENV}
    </span>
  );
}
