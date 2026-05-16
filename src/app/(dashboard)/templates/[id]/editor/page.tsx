export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">Template Editor</h1>
      <p className="text-[14px] text-fg-2 mt-2">Editing template {id}</p>
    </div>
  );
}
