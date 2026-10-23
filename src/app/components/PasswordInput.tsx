"use client";

import { useState } from "react";

import EyeIcon from "@/src/app/components/EyeIcon";

type PasswordInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  disabled?: boolean;
};

export default function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  disabled,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-12 text-sm text-slate-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black disabled:bg-slate-50"
        />

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 transition hover:text-black disabled:opacity-50"
          aria-label={
            visible ? "Sembunyikan password" : "Tampilkan password"
          }
          aria-pressed={visible}
        >
          <EyeIcon hidden={!visible} />
        </button>
      </div>
    </div>
  );
}