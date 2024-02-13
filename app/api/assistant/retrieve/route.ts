import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_API_ENDPOINT
} from "@/const/default";
import { NextRequest } from "next/server";
import OpenAI from "openai";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const assistantId = searchParams.get("id");

  if (assistantId === null) {
    return Response.json({ error: "Assistant ID is required" });
  }

  let openai;
  if (process.env.AZURE_OPENAI_API === 'true') {
    openai = new OpenAI({
      apiKey: AZURE_OPENAI_API_KEY,
      baseURL: AZURE_OPENAI_API_ENDPOINT,
      defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION },
      defaultHeaders: { 'api-key': AZURE_OPENAI_API_KEY },
    });
  } else {
    openai = new OpenAI();
  }

  // console.log('Assistant ID:', assistantId);

  try {
    const assistants = await openai.beta.assistants.retrieve(assistantId);

    // const assistants = response.data;

    // console.log(assistants);

    return Response.json({ assistants: assistants });
  } catch (e) {
    console.log(e);
    return Response.json({ error: e });
  }
}