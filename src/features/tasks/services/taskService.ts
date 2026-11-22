import { supabase } from "@/lib/supabase/client";
import type { Task } from "@/features/tasks/types/task";

export async function getPublishedTasks(): Promise<Task[]> {
    const { data, error } = await supabase
        .from("tasks")
        .select(`
      id,
      course_id,
      title,
      description,
      semester,
      academic_year,
      deadline,
      status,
      work_type,
      content,
      document_name,
      document_path,
      thumbnail_path,
      created_at,
      courses (
        name
      )
    `)
        .eq("status", "published")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Gagal mengambil data tugas:", error.message);
        throw new Error("Tidak dapat mengambil data tugas.");
    }

    return (data ?? []) as unknown as Task[];
}
