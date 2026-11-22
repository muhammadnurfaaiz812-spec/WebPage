export type TaskStatus = "draft" | "published";

// Nilai di database (kolom work_type) dan label yang tampil di UI
export type WorkType = "individual" | "group";

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
    individual: "Individu",
    group: "Kelompok",
};

export interface Task {
    id: string;
    course_id: string;
    title: string;
    description: string | null;
    semester: number;
    academic_year: string;
    deadline: string | null;
    status: TaskStatus;
    work_type: WorkType;
    content: string | null;
    document_name: string | null;
    document_path: string | null;
    thumbnail_path: string | null;
    created_at: string;
    courses: {
        name: string;
    } | null;
}
