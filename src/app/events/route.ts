import {
  handleCreateCustomEventRequest,
  handleListCustomEventsRequest,
} from "@/lib/api/events";

export async function POST(request: Request): Promise<Response> {
  return await handleCreateCustomEventRequest(request);
}

export async function GET(request: Request): Promise<Response> {
  return await handleListCustomEventsRequest(request);
}
