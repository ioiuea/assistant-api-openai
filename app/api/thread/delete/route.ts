import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_API_ENDPOINT
} from "@/const/default";
import { NextRequest } from "next/server";
import OpenAI from "openai";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const threadId = searchParams.get("threadId");

  if (!threadId)
    return Response.json({ error: "No id provided" }, { status: 400 });

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

  try {
    const thread = await openai.beta.threads.del(threadId);

    // console.log(thread);

    return Response.json({ thread: thread });
  } catch (e) {
    console.log(e);
    return Response.json({ error: e });
  }
}
