// ProfileModel.tsx
// Modal profil: ubah nama/foto, ganti email, dan ganti password.
// (Nama file memakai "Model"; DashboardNavbar mengimpor dengan nama yang sama.)

"use client";

import EmailSection from "./EmailSection";
import PasswordSection from "./PasswordSection";
import ProfileSection from "./ProfileSection";

// Props: data user dan fungsi untuk menutup modal.
type ProfileModalProps = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar: string | null;
  };
  onClose: () => void;
};

// Kerangka modal yang berisi tiga bagian.
export default function ProfileModal({ user, onClose }: ProfileModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8"
      onMouseDown={(event) => {
        // Tutup modal hanya jika yang diklik adalah latar gelap (bukan isi modal).
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md space-y-6 rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Profil</h2>

            <p className="mt-1 text-sm text-slate-500">
              Kelola informasi dan keamanan akun.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg px-2 py-1 text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        {/* Bagian 1: nama dan foto profil. */}
        <ProfileSection user={user} />

        <hr />

        {/* Bagian 2: ganti email (dengan OTP). */}
        <EmailSection currentEmail={user.email} />

        <hr />

        {/* Bagian 3: ganti password (dengan OTP). */}
        <PasswordSection />
      </div>
    </div>
  );
}