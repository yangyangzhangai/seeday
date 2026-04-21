// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/profile/README.md

const ADMIN_ROLES = new Set(['admin', 'owner', 'staff', 'internal', 'super_admin']);

export function isTelemetryAdmin(user: unknown): boolean {
  const source = user as {
    app_metadata?: { role?: unknown; roles?: unknown };
    user_metadata?: { role?: unknown; roles?: unknown };
  } | null;

  const roleCandidates: unknown[] = [
    source?.app_metadata?.role,
    source?.user_metadata?.role,
    ...(Array.isArray(source?.app_metadata?.roles) ? source?.app_metadata?.roles : []),
    ...(Array.isArray(source?.user_metadata?.roles) ? source?.user_metadata?.roles : []),
  ];

  return roleCandidates.some((item) => (
    typeof item === 'string' && ADMIN_ROLES.has(item.trim().toLowerCase())
  ));
}
