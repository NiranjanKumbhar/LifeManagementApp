export interface Resource {
  id: string;
  projectId: string | null;
  taskId: string | null;
  personId: string | null;
  name: string;
  fileType: string;
  storagePath: string;
  sizeBytes: number | null;
  uploadedBy: string;
  createdAt: Date;
}
