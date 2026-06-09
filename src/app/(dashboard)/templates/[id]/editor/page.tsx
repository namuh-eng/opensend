import { TemplateEditor } from "@/components/template-editor";

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <TemplateEditor templateId={id} />;
}
