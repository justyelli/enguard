"use client";

import { useState } from "react";

export default function ConfirmButton({
  onConfirm,
  icon = "🗑",
  label,
  confirmText = "Удалить?",
  className = "",
}: {
  onConfirm: () => void;
  icon?: string;
  label: string;
  confirmText?: string;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onConfirm();
          }}
          className="rounded-lg bg-danger px-2 py-1 text-xs font-medium text-white"
        >
          {confirmText}
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(false);
          }}
          className="rounded-lg border border-border px-2 py-1 text-xs"
        >
          Нет
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirming(true);
      }}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-danger ${className}`}
    >
      {icon}
    </button>
  );
}
