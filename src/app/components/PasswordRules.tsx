// PasswordRules.tsx
// Checklist syarat password; centang hijau jika terpenuhi.
// Aturannya dari PASSWORD_RULES (sama dengan validasi di server).

import { PASSWORD_RULES } from "@/src/lib/validation";

// Menampilkan status tiap syarat untuk password yang sedang diketik.
export default function PasswordRules({ value }: { value: string }) {
  return (
    <div className="mt-2 space-y-1 text-xs">
      {/* Satu baris untuk setiap syarat. */}
      {PASSWORD_RULES.map((rule) => (
        <p
          key={rule.id}
          className={
            rule.test(value) ? "text-green-600" : "text-slate-400"
          }
        >
          {rule.test(value) ? "✓" : "○"} {rule.label}
        </p>
      ))}
    </div>
  );
}