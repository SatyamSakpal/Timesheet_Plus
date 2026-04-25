import { ActivityTemplateEditorPage } from "@/views/admin/activity-template-editor-page";

export default function TenantActivityTemplateDetailPage({
  params
}: {
  params: { taskTemplateId: string };
}) {
  return <ActivityTemplateEditorPage mode="edit" taskTemplateId={params.taskTemplateId} />;
}
