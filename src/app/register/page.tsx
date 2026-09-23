"use client";

import { FormEvent, useState } from "react"; 
import Link from "next/link"; 
import { useRouter } from "next/navigation";

export default function RegisterPage() { 
  const router = useRouter();

  const [name, setName] = useState(""); 
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState(""); 
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false); 
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState(""); 
  const [loading, setLoading] = useState(false);

  // Validasi password 
  const passwordRules = { 
    minLength: password.length >= 8, 
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password), 
    number: /[0-9]/.test(password), 
    special: /[^A-Za-z0-9]/.test(password),
  };

  const passwordIsValid = 
    passwordRules.minLength && 
    passwordRules.uppercase && 
    passwordRules.lowercase && 
    passwordRules.number && 
    passwordRules.special;

    async function handleSubmit(event: FormEvent<HTMLFormElement>){ event.preventDefault();

    setError(""); 
    
    // Validasi nama 
    if (!name.trim()) { 
      setError("Nama wajib diisi."); 
      return; 
    }

    if (name.trim().length < 4) { 
      setError("Nama minimal 4 karakter."); 
      return; 
    }

    // Validasi email 
    if (!email.trim()) { 
      setError("Email wajib diisi."); 
      return; 
    }

    // Validasi password 
    if (!password) { 
      setError("Password wajib diisi."); 
      return; 
    }

    if (!passwordIsValid) { 
      setError( 
        "Password belum memenuhi semua persyaratan." 
      ); 
      return; 
    }

    // Validasi konfirmasi password 
    if (!confirmPassword) { 
      setError("Konfirmasi password wajib diisi."); 
      return; 
    }

    setLoading(true);

    try { 
      const response = await fetch("/api/auth/register", { 
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
        },
        body: JSON.stringify({ 
          name, 
          email, 
          password, 
        }),
      });

      const data = await response.json();
      if (!response.ok) { 
        // Jika backend mengirim error field dari Zod 
        const fieldErrors = data.errors;

        if (fieldErrors) { 
          const firstError = 
            fieldErrors.name?.[0] ?? 
            fieldErrors.email?.[0] ?? 
            fieldErrors.password?.[0];

            setError( 
              firstError ?? 
                data.message ?? 
                "Data registrasi tidak valid."
            );
          } else {
            setError(data.message ?? "Registrasi gagal.");
          }

          return;
        }

        router.push("/login"); 
      } catch { 
        setError("Tidak dapat terhubung ke server."); 
      } finally { 
        setLoading(false); 
      } 
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8"> 
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow"> 
          <h1 className="mb-2 text-2xl font-bold text-slate-600"> 
            Register 
          </h1>

          <p className="mb-6 text-sm text-slate-500"> 
            Buat akun baru untuk menggunakan aplikasi. 
          </p>

          <form onSubmit={handleSubmit} className="space-y-4"> 
            <div> 
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-400" > 
                Nama 
              </label>

              <input 
                id="name" 
                type="text" 
                value={name} 
                onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border px-3 py-2 outline-none focus:border-black text-slate-400 focus:text-slate-200" 
                placeholder="Nama lengkap" 
                autoComplete="name" 
              />

              {name.length > 0 && name.trim().length < 4 && ( 
                <p className="mt-1 text-xs text-red-500"> 
                  Nama minimal 4 karakter. 
                </p> 
              )} 
            </div>

            <div> 
              <label 
              htmlFor="email" 
              className="mb-1 block text-sm font-medium text-slate-400" 
              > 
                Email 
              </label>

              <input 
                id="email" 
                type="email" 
                value={email} 
                onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border px-3 py-2 outline-none focus:border-black text-slate-400 focus:text-slate-200" placeholder="email@example.com" autoComplete="email" 
              />
            </div>

            <div> 
              <label 
                htmlFor="password" 
                className="mb-1 block text-sm font-medium text-slate-400" 
              > 
                Password 
              </label>

              <div className="relative"> 
                <input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  value={password} onChange={(event) => setPassword(event.target.value)} 
                  className="w-full rounded-lg border px-3 py-2 pr-12 outline-none focus:border-black text-slate-400 focus:text-slate-200" 
                  placeholder="Buat password" autoComplete="new-password" 
                />

                <button 
                  type="button" 
                  onClick={() => 
                    setShowPassword((current) => !current) } 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-black" aria-label={ 
                    showPassword 
                    ? "Sembunyikan password" 
                    : "Tampilkan password" 
                  }
                >
                  {showPassword ? ( 
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="20" 
                      height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                    >
                      <path d="M3 3l18 18" /> 
                      <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" /> <path d="M9.88 4.24A9.77 9.77 0 0 1 12 4c5 0 9.27 3.11 11 8a18.5 18.5 0 0 1-2.16 3.19" /> <path d="M6.61 6.61C4.62 7.96 3.13 9.83 2 12c1.73 4.89 6 8 10 8a9.77 9.77 0 0 0 2.12-.24" />
                    </svg>
                  ) : ( 
                    <svg
                      xmlns="http://www.w3.org/2000/svg" 
                      width="20" 
                      height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /> <circle cx="12" cy="12" r="3" />
                    </svg>
                  )} 
                </button> 
              </div>

              <div className="mt-2 space-y-1 text-xs"> <PasswordRule 
                valid={passwordRules.minLength} 
                text="Minimal 8 karakter" 
              />

              <PasswordRule 
                valid={passwordRules.uppercase} 
                text="Minimal 1 huruf kapital (A-Z)" 
              />

              <PasswordRule 
                valid={passwordRules.lowercase} 
                text="Minimal 1 huruf kecil (a-z)" 
              />

              <PasswordRule 
                valid={passwordRules.number} 
                text="Minimal 1 angka (0-9)" 
              />

              <PasswordRule 
                valid={passwordRules.special} 
                text="Minimal 1 karakter khusus (!@#$%)" 
              />
            </div>
          </div>

          <div> 
            <label 
              htmlFor="confirmPassword" 
              className="mb-1 block text-sm font-medium text-slate-400" 
            > 
              Konfirmasi Password 
            </label>

            <div className="relative"> 
              <input 
                id="confirmPassword" 
                type={ 
                  showConfirmPassword ? "text" : "password" 
                }
                value={confirmPassword} 
                onChange={(event) =>
                  setConfirmPassword(event.target.value) 
                } 
                className="w-full rounded-lg border px-3 py-2 pr-12 outline-none focus:border-black text-slate-400 focus:text-slate-200" placeholder="Ulangi password" autoComplete="new-password" 
              />

              <button 
                type="button" 
                onClick={() => 
                  setShowConfirmPassword( 
                    (current) => !current 
                  ) 
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-black" 
                aria-label={ 
                  showConfirmPassword ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password" 
                }
              >
                {showConfirmPassword ? ( 
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" >
                      <path d="M3 3l18 18" /> 
                      <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" /> <path d="M9.88 4.24A9.77 9.77 0 0 1 12 4c5 0 9.27 3.11 11 8a18.5 18.5 0 0 1-2.16 3.19" /> <path d="M6.61 6.61C4.62 7.96 3.13 9.83 2 12c1.73 4.89 6 8 10 8a9.77 9.77 0 0 0 2.12-.24" />
                  </svg>
                ) : ( 
                  <svg 
                    xmlns="http://www.w3.org/2000/svg"
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /> 
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                )}
              </button> 
            </div>
          {confirmPassword && ( 
            <p
             className={`mt-1 text-xs ${ 
              password === confirmPassword 
              ? "text-green-600" 
              : "text-red-500" 
              }`}
            >
              {password === confirmPassword 
              ? "Password cocok." 
              : "Password tidak sama."}
            </p>
          )} 
        </div> 
         
        {error && ( 
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
          > 
            {error} 
          </div> 
        )}

        <button 
          type="submit" 
          disabled={loading} 
          className="w-full rounded-lg bg-black px-4 py-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50" 
          > 
            {loading ? "Mendaftarkan..." : "Register"} 
          </button> 
        </form>

        <p className="mt-6 text-center text-sm text-slate-500"
        > 
          Sudah punya akun?{" "} 
          <Link 
          href="/login" 
          className="font-medium text-black underline" 
          > 
            Login 
          </Link> 
        </p>

      </div> 
    </main> 
  ); 
}

function PasswordRule({ 
  valid, 
  text, 
}: { 
  valid: boolean; 
  text: string;
}) { 
  return ( 
    <p className={ valid ? "text-green-600" : "text-slate-400" } >    {valid ? "✓" : "○"} {text} 
    </p> 
  ); 
}