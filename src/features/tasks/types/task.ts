
export type TaskStatus = "draft" | "published";

export interface Task {
    id: string;
    course_id: string;
    title: string;
    description: string | null;
    semester: number;
    academic_year: string;
    deadline: string | null;
    status: TaskStatus;
    document_name: string | null;
    document_path: string | null;
    created_at: string;
    courses: {
        name: string;
    } | null;
}
