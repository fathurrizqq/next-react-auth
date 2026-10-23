import { PASSWORD_RULES } from "@/src/lib/validation";

export default function PasswordRules({ value }: { value: string }) {
  return (
    <div className="mt-2 space-y-1 text-xs">
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