"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import EyeIcon from "@/src/app/components/EyeIcon";

type LoginResponse = {
    message?: string;
    errors?: {
        email?: string[];
        password?: string[];
    };
};

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (loading) return;

        setError("");

        const normalizedEmail = email.trim().toLowerCase();

        if (!normalizedEmail) {
            setError("Email wajib diisi.");
            return;
        }

        if (!password) {
            setError("Password wajib diisi.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: normalizedEmail,
                    password,
                }),
            });

            const data: LoginResponse = await response
                .json()
                .catch(() => ({}));

            if (!response.ok) {
                const firstFieldError =
                    data.errors?.email?.[0] ??
                    data.errors?.password?.[0];

                setError(
                    firstFieldError ??
                    data.message ??
                    "Login gagal. Silakan coba kembali.",
                );

                return;
            }

            router.push("/dashboard");
            router.refresh();
        } catch {
            setError(
                "Terjadi masalah saat menghubungi server. Silakan coba kembali.",
            );
        } finally {
            setLoading(false);
        }
    }

    function togglePasswordVisibility() {
        setShowPassword((current) => !current);
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
            <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
                {/* Header */}
                <h1 className="mb-2 text-2xl font-bold text-slate-900">
                    Login
                </h1>

                <p className="mb-6 text-sm text-slate-500">
                    Masuk ke dashboard.
                </p>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* Email */}
                    <div>
                        <label
                            htmlFor="email"
                            className="mb-1 block text-sm font-medium text-slate-700"
                        >
                            Email
                        </label>

                        <input
                            id="email"
                            name="email"
                            type="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                            placeholder="email@example.com"
                            autoComplete="email"
                            disabled={loading}
                            required
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label
                            htmlFor="password"
                            className="mb-1 block text-sm font-medium text-slate-700"
                        >
                            Password
                        </label>

                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                type={
                                    showPassword
                                        ? "text"
                                        : "password"
                                }
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-12 text-slate-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                                placeholder="Masukkan password"
                                autoComplete="current-password"
                                disabled={loading}
                                required
                            />

                            <button
                                type="button"
                                onClick={togglePasswordVisibility}
                                disabled={loading}
                                className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-500 transition hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={
                                    showPassword
                                        ? "Sembunyikan password"
                                        : "Tampilkan password"
                                }
                                aria-pressed={showPassword}
                                aria-controls="password"
                            >
                                <EyeIcon hidden={!showPassword} />
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div
                            role="alert"
                            aria-live="polite"
                            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
                        >
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-black px-4 py-2 text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? "Memproses..." : "Login"}
                    </button>
                </form>

                {/* Register */}
                <p className="mt-6 text-center text-sm text-slate-500">
                    Belum punya akun?{" "}
                    <Link
                        href="/register"
                        className="font-medium text-black underline underline-offset-2"
                    >
                        Register
                    </Link>
                </p>

                {/* Forgot Password */}
                <div className="mt-2 text-center">
                    <Link
                        href="/forgot-password"
                        className="text-sm text-slate-600 underline underline-offset-2 transition hover:text-black"
                    >
                        Lupa password?
                    </Link>
                </div>
            </div>
        </main>
    );
}
