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
      content_title,
      show_description,
      show_content,
      link_url,
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

    const tasks = (data ?? []) as unknown as Task[];

    // Kolom yang disembunyikan admin, atau yang kosong, diperlakukan sebagai
    // tidak ada di sisi publik
    return tasks.map((task) => ({
        ...task,
        description: task.show_description
            ? task.description?.trim() || null
            : null,
        content: task.show_content ? task.content?.trim() || null : null,
    }));
}