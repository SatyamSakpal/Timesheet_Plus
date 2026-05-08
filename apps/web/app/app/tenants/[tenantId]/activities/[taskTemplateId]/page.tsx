import { ActivityTemplateEditorPage } from "@/views/admin/activity-template-editor-page";

export default async function TenantActivityTemplateDetailPage({
  params
}: {
  params: Promise<{ taskTemplateId: string }>;
}) {
  const { taskTemplateId } = await params;
  return <ActivityTemplateEditorPage mode="edit" taskTemplateId={taskTemplateId} />;
}
