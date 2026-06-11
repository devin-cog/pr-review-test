import React from "react";

export interface ButtonProps {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({ label, variant = "primary", disabled, onClick }: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : variant === "danger"
        ? "bg-red-600 text-white hover:bg-red-700"
        : "bg-gray-200 text-gray-900 hover:bg-gray-300";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-4 py-2 text-sm font-medium disabled:opacity-50 ${styles}`}
    >
      {label}
    </button>
  );
}
