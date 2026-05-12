import { handleDeleteSuppressionRequest } from "@/lib/api/suppressions";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ email: string }> },
): Promise<Response> {
  const { email } = await params;
  return await handleDeleteSuppressionRequest(request, email);
}
