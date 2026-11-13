
"use client";

import { useEffect, useState } from "react";
import { getPublishedTasks } from "@/features/tasks/services/taskService";
import type { Task } from "@/features/tasks/types/task";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTasks() {
      try {
        setLoading(true);
        setError(null);

        const data = await getPublishedTasks();
        setTasks(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat mengambil data tugas."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, []);

  return {
    tasks,
    loading,
    error,
  };
}
