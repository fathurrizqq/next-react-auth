type CodeInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

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
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, ""))
        }
        disabled={disabled}
        placeholder="6 digit kode"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.4em] text-slate-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black disabled:bg-slate-50"
      />
    </div>
  );
}