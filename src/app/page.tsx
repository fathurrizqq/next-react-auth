import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/src/app/auth/login");
}