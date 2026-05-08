import { TenantPathSync } from "@/components/layout/tenant-path-sync";

export default async function TenantScopedLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  return <TenantPathSync tenantId={tenantId}>{children}</TenantPathSync>;
}
