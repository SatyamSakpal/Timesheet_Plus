import { TenantPathSync } from "@/components/layout/tenant-path-sync";

export default function TenantScopedLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { tenantId: string };
}) {
  return <TenantPathSync tenantId={params.tenantId}>{children}</TenantPathSync>;
}

