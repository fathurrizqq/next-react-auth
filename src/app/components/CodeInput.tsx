// CodeInput.tsx
// Input kode verifikasi (OTP) 6 digit.

// Props: id input, nilai, fungsi saat berubah, dan status disabled.
type CodeInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

// Kolom kode verifikasi yang hanya menerima angka.
export default function CodeInput({
  id,
  value,
  onChange,
  disabled,
}: CodeInputProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        Kode Verifikasi
      </label>

      <input
        id={id}
        type="text"
        // Di HP muncul keyboard angka.
        inputMode="numeric"
        // Browser/HP bisa menyarankan kode OTP dari pesan yang masuk.
        autoComplete="one-time-code"
        // Maksimal 6 digit.
        maxLength={6}
        value={value}
        onChange={(event) =>
          // Buang semua karakter selain angka.
          onChange(event.target.value.replace(/\D/g, ""))
        }
        disabled={disabled}
        placeholder="6 digit kode"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.4em] text-slate-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black disabled:bg-slate-50"
      />
    </div>
  );
}