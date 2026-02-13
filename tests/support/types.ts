export type TestEnv = {
  baseURL: string;
  e2eProjectId: string;
  databaseUrl?: string;
  openAiApiKey?: string;
  insightsApiToken?: string;
};

export type CreatedEmployee = {
  id: string;
  fullName: string;
  email?: string | null;
};

export type CreatedAssignment = {
  id: string;
  employeeId: string;
  projectId: string | null;
};

export type CleanupFailure = {
  entityType: "assignment" | "employee";
  entityId: string;
  reason: string;
};
