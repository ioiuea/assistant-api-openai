import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_API_RESOURCE
} from "@/const/default";
import { NextRequest } from "next/server";
import OpenAI from "openai";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const assistantId = searchParams.get("id");

  if (assistantId === null) {
    return Response.json({ error: "Assistant ID is required" });
  }

  const openai = new OpenAI({
    apiKey: AZURE_OPENAI_API_KEY,
    baseURL: `https://${AZURE_OPENAI_API_RESOURCE}.openai.azure.com/openai`,
    defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION },
    defaultHeaders: { 'api-key': AZURE_OPENAI_API_KEY },
  });

  console.log('Assistant ID:', assistantId);

  try {
    const assistants = await openai.beta.assistants.retrieve(assistantId);

    // const assistants = response.data;

    console.log(assistants);

    return Response.json({ assistants: assistants });
  } catch (e) {
    console.log(e);
    return Response.json({ error: e });
  }
}