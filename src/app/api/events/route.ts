import {
  handleCreateCustomEventRequest,
  handleDeleteCustomEventCollectionRequest,
  handleListCustomEventsRequest,
} from "@/lib/api/events";

export async function POST(request: Request): Promise<Response> {
  return await handleCreateCustomEventRequest(request);
}

export async function GET(request: Request): Promise<Response> {
  return await handleListCustomEventsRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return await handleDeleteCustomEventCollectionRequest(request);
}
