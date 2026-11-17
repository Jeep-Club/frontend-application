export const medicalPermissions = {
    module: "HEALTH",
    read: "MEDICAL_PROFILE_READ",
    update: "MEDICAL_PROFILE_UPDATE",
    delete: "MEDICAL_PROFILE_DELETE",
    export: "MEDICAL_PROFILE_EXPORT",
} as const;

// Event emergency consultation never grants general HEALTH read or export.
export const emergencyMedicalPermissions = {
    module: "PUBLICATIONS",
    read: "EVENT_HEALTH_EMERGENCY_READ",
} as const;
