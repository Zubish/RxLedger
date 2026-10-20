export type PatientDetails = {
  age?: number;
  gender?: "female" | "male" | "other" | "prefer_not_to_say";
  allergyStatus: "unknown" | "none" | "recorded";
  allergies: string;
  updatedAt?: string;
  ageRecordedAt?: string;
};
