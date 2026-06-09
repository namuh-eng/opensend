import {
  handleDeleteCustomEventRequest,
  handleGetCustomEventRequest,
  handleUpdateCustomEventRequest,
} from "@/lib/api/events";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ identifier: string }> },
): Promise<Response> {
  const { identifier } = await params;
  return await handleGetCustomEventRequest(request, identifier);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ identifier: string }> },
): Promise<Response> {
  const { identifier } = await params;
  return await handleUpdateCustomEventRequest(request, identifier);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ identifier: string }> },
): Promise<Response> {
  const { identifier } = await params;
  return await handleDeleteCustomEventRequest(request, identifier);
}
