import { supabase } from "@/lib/supabase/client";
import { DOCUMENT_BUCKET } from "@/features/tasks/lib/documents";
import type { Task, TaskStatus } from "@/features/tasks/types/task";

/* ────────────────────────────────────────────────────────────
   KONFIGURASI
   ──────────────────────────────────────────────────────────── */

// Nama bucket ada di @/features/tasks/lib/documents (dipakai bersama halaman publik)

// Harus sama dengan batas dan jenis berkas yang diizinkan bucket
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const FILE_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".zip",
  ".txt",
];

export type Course = { id: string; name: string; code: string | null };

export type TaskInput = Pick<
  Task,
  | "id"
  | "course_id"
  | "title"
  | "description"
  | "semester"
  | "academic_year"
  | "deadline"
  | "status"
  | "work_type"
  | "content"
  | "content_title"
  | "show_description"
  | "show_content"
  | "link_url"
>;

const TASK_SELECT = `
  id, course_id, title, description, semester, academic_year, deadline,
  status, work_type, content, content_title, show_description, show_content,
  link_url, document_name, document_path, thumbnail_path, created_at,
  courses ( name )
`;

/* ────────────────────────────────────────────────────────────
   HELPER
   ──────────────────────────────────────────────────────────── */

type DbError = { message: string; code?: string };

function fail(action: string, error: DbError): never {
  console.error(`${action}:`, error.message);
  const denied =
    error.code === "42501" ||
    /row-level security|not authorized|unauthorized/i.test(error.message);
  if (denied) {
    throw new Error(
      `${action}: akun ini tidak punya izin. Pastikan emailmu terdaftar di tabel admins.`
    );
  }
  throw new Error(`${action}: ${error.message}`);
}

// RLS yang menolak UPDATE/DELETE tidak mengembalikan error, hanya nol baris.
// Pemeriksaan ini mencegah "berhasil" palsu.
function ensureChanged(rows: unknown[] | null, action: string) {
  if (!rows || rows.length === 0) {
    throw new Error(
      `${action}: tidak ada data yang berubah. Periksa apakah akunmu terdaftar sebagai admin.`
    );
  }
}

function safeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
  const clean =
    base
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "berkas";
  return `${clean}${ext.replace(/[^a-z0-9.]/g, "")}`;
}

// Hapus berkas dari bucket. Gagal di sini tidak menggagalkan aksi utama.
async function removeFiles(paths: string[]) {
  const own = paths.filter((p) => !/^https?:\/\//i.test(p));
  if (own.length === 0) return;
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).remove(own);
  if (error) console.error("Gagal menghapus berkas:", error.message);
}

/**
 * Apakah path gambar sampul ini dipilih sendiri oleh admin?
 * Sampul pilihan admin disimpan sebagai "<id>/cover-<waktu>.jpg"; gambar
 * otomatis dari berkas memakai "preview-". Awalan itu yang membedakannya,
 * jadi sampul manual tidak ikut terhapus saat berkasnya diganti.
 */
export function isManualCover(path: string | null | undefined) {
  return Boolean(path && /\/cover-\d+\.jpg$/.test(path));
}

/* ────────────────────────────────────────────────────────────
   AUTH
   ──────────────────────────────────────────────────────────── */

export async function checkIsAdmin() {
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(
      error.status === 400 ? "Email atau kata sandi salah." : error.message
    );
  }
  if (!(await checkIsAdmin())) {
    await supabase.auth.signOut();
    throw new Error("Akun ini bukan admin.");
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}

/* ────────────────────────────────────────────────────────────
   MATA KULIAH
   ──────────────────────────────────────────────────────────── */

export async function listCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, code")
    .order("name");
  if (error) fail("Gagal memuat mata kuliah", error);
  return (data ?? []) as Course[];
}

export async function createCourse(
  name: string,
  code: string
): Promise<Course> {
  const { data, error } = await supabase
    .from("courses")
    .insert({ name, code: code || null })
    .select("id, name, code")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("Kode mata kuliah itu sudah dipakai.");
    }
    fail("Gagal menambah mata kuliah", error);
  }
  return data as Course;
}

/* ────────────────────────────────────────────────────────────
   TUGAS
   Admin boleh membaca semua tugas, termasuk draft (policy RLS).
   ──────────────────────────────────────────────────────────── */

export async function listAllTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .order("created_at", { ascending: false });
  if (error) fail("Gagal memuat tugas", error);
  return (data ?? []) as unknown as Task[];
}

export async function getTask(id: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null; // id bukan UUID yang valid
    fail("Gagal memuat tugas", error);
  }
  return (data as unknown as Task | null) ?? null;
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  const { data, error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error) fail("Gagal mengubah status", error);
  ensureChanged(data, "Gagal mengubah status");
}

export async function deleteTask(task: Task) {
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", task.id)
    .select("id");
  if (error) fail("Gagal menghapus tugas", error);
  ensureChanged(data, "Gagal menghapus tugas");
  await removeFiles(
    [task.document_path, task.thumbnail_path].filter((p): p is string =>
      Boolean(p)
    )
  );
}

/**
 * Simpan tugas baru atau perubahan. Urutannya sengaja: unggah berkas dan
 * gambar sampul baru, simpan baris, lalu hapus yang lama. Kalau ada langkah
 * yang gagal, unggahan baru dibersihkan supaya tidak ada berkas yatim.
 *
 * Berkas disimpan di "<task_id>/<nama-aman>". Gambar sampul disimpan di
 * "<task_id>/preview-<waktu>.jpg" (dibuat otomatis dari berkas) atau
 * "<task_id>/cover-<waktu>.jpg" (dipilih admin); nama unik supaya cache tidak
 * menampilkan gambar lama. Path itu dicatat di document_path dan
 * thumbnail_path, tanpa nama bucket.
 *
 * Saat berkas diganti atau dihapus, gambar otomatis lama dibuang, tetapi
 * sampul pilihan admin dipertahankan (lihat isManualCover).
 */
export async function saveTask(args: {
  input: TaskInput;
  previous: Task | null; // null = tugas baru
  newFile: File | null;
  removeFile: boolean;
  newPreview: Blob | null; // JPEG gambar sampul, dibuat di browser
  newPreviewManual?: boolean; // true = gambar sampul pilihan admin
  removeThumbnail?: boolean; // hapus gambar sampul saja, berkas tetap
}) {
  const {
    input,
    previous,
    newFile,
    removeFile,
    newPreview,
    newPreviewManual = false,
    removeThumbnail = false,
  } = args;

  const oldPath = previous?.document_path ?? null;
  const oldThumb = previous?.thumbnail_path ?? null;
  let document_name = previous?.document_name ?? null;
  let document_path = oldPath;
  let thumbnail_path = oldThumb;
  let uploadedPath: string | null = null;
  let uploadedThumb: string | null = null;

  // Berkas diganti atau dihapus: gambar otomatis lama tidak berlaku lagi.
  // Sampul pilihan admin tetap dipakai. Admin juga bisa menghapus sampul saja.
  if ((newFile || removeFile) && !isManualCover(oldThumb)) {
    thumbnail_path = null;
  }
  if (removeThumbnail) thumbnail_path = null;

  try {
    if (newFile) {
      const path = `${input.id}/${safeFileName(newFile.name)}`;
      const { error } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(path, newFile, {
          upsert: true,
          cacheControl: "3600",
          contentType: newFile.type || undefined,
        });
      if (error) fail("Gagal mengunggah berkas", error);
      uploadedPath = path;
      document_name = newFile.name;
      document_path = path;
    } else if (removeFile) {
      document_name = null;
      document_path = null;
    }

    if (newPreview) {
      const path = `${input.id}/${newPreviewManual ? "cover" : "preview"}-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(path, newPreview, {
          cacheControl: "31536000",
          contentType: "image/jpeg",
        });
      if (error) {
        fail("Gagal mengunggah gambar sampul (apakah migrasi pratinjau sudah dijalankan?)", error);
      }
      uploadedThumb = path;
      thumbnail_path = path;
    }

    const { id, ...fields } = {
      ...input,
      document_name,
      document_path,
      thumbnail_path,
    };

    if (previous) {
      const { data, error } = await supabase
        .from("tasks")
        .update(fields)
        .eq("id", id)
        .select("id");
      if (error) fail("Gagal menyimpan tugas", error);
      ensureChanged(data, "Gagal menyimpan tugas");
    } else {
      const { error } = await supabase.from("tasks").insert({ id, ...fields });
      if (error) fail("Gagal menyimpan tugas", error);
    }
  } catch (err) {
    const orphans: string[] = [];
    if (uploadedPath && uploadedPath !== oldPath) orphans.push(uploadedPath);
    if (uploadedThumb) orphans.push(uploadedThumb);
    await removeFiles(orphans);
    throw err;
  }

  const stale: string[] = [];
  if (oldPath && oldPath !== document_path) stale.push(oldPath);
  if (oldThumb && oldThumb !== thumbnail_path) stale.push(oldThumb);
  await removeFiles(stale);
}