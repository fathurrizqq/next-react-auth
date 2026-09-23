import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Nama wajib diisi." }) 
    .min(4, { message: "Nama minimal 4 karakter." }),
  email: z
    .string()
    .trim()
    .min(1, { message: "Email wajib diisi." }) 
    .toLowerCase() 
    .email({ message: "Format email tidak valid." }),
  password: z
    .string()
    .min(1, { message: "Password wajib diisi." })
    .min(8, { message: "Password minimal 8 karakter." })
    .regex(/[A-Z]/, 
      { message: "Password harus mengandung huruf kapital." })
    .refine((password) => /[a-z]/.test(password),
      {message: "Password harus mengandung minimal 1 huruf kecil."})
    .refine((password) => /[0-9]/.test(password),
      {message: "Password harus mengandung minimal 1 angka"})
    .refine((password) => /[^A-Za-z0-9]/.test(password),
      {message: "Password harus mengandung minimal 1 karakter khusus"}),
});

export async function POST(req: Request) {
  try {
    // Ambil data dari request body dan validasi menggunakan registerSchema
    const body = await req.json();

    // Validasi data menggunakan Zod
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { 
          message: "Data registrasi tidak valid.",
          errors: result.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    //Ambil data yang sudah tervalidasi
    const { name, email, password } = result.data;

    // Cek apakah email sudah terdaftar
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { 
          message: "Email sudah terdaftar." 
        },
        { status: 400 }
      );
    }

    // Hash password sebelum disimpan ke database
    const hashedPassword = await bcrypt.hash(password, 12);

    //Buat user baru di database
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role: "USER",
      },
    });

    // Kirim response berhasil
    return NextResponse.json(
      {
        message: "Registrasi berhasil.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saat registrasi:", error);
    return NextResponse.json(
      { 
        message: "Terjadi kesalahan saat registrasi." 
      },
      { status: 500 }
    );
  }
}

