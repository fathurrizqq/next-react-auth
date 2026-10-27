// EyeIcon.tsx
// Ikon mata untuk tombol lihat / sembunyikan password.

// hidden = true: password sedang tersembunyi (ikon mata tercoret).
type EyeIconProps = {
  hidden: boolean;
};

// Mengembalikan ikon SVG sesuai status tampil / sembunyi.
export default function EyeIcon({ hidden }: EyeIconProps) {
  if (hidden) {
    // Ikon mata tercoret: password tersembunyi.
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M3 3l18 18" />
        <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
        <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 8.5 4 10 8a16.2 16.2 0 0 1-2.1 3.36" />
        <path d="M6.61 6.61C4.8 7.83 3.47 9.61 2 12c1.5 4 5 8 10 8a10.7 10.7 0 0 0 4.11-.81" />
      </svg>
    );
  }

  // Ikon mata terbuka: password terlihat.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
