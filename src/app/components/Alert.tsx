import type { ReactNode } from "react";

type AlertProps = {
  type: "error" | "success";
  children: ReactNode;
};

export default function Alert({ type, children }: AlertProps) {
  const styles =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-600"
      : "border-green-200 bg-green-50 text-green-700";

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`rounded-lg border p-3 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}