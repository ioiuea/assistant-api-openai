import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_API_RESOURCE
} from "@/const/default";
import { NextRequest } from "next/server";
import OpenAI from "openai";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const threadId = searchParams.get("threadId");
  const runId = searchParams.get("runId");

  if (!threadId)
    return Response.json({ error: "No thread id provided" }, { status: 400 });
  if (!runId)
    return Response.json({ error: "No run id provided" }, { status: 400 });

    const openai = new OpenAI({
      apiKey: AZURE_OPENAI_API_KEY,
      baseURL: `https://${AZURE_OPENAI_API_RESOURCE}.openai.azure.com/openai`,
      defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION },
      defaultHeaders: { 'api-key': AZURE_OPENAI_API_KEY },
    });

  try {
    const run = await openai.beta.threads.runs.cancel(threadId, runId);

    console.log(run);

    return Response.json({ run: run });
  } catch (e) {
    console.log(e);
    return Response.json({ error: e });
  }
}