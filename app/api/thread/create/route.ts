import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_API_RESOURCE
} from "@/const/default";
import OpenAI from "openai";

export async function GET() {
  const openai = new OpenAI({
    apiKey: AZURE_OPENAI_API_KEY,
    baseURL: `https://${AZURE_OPENAI_API_RESOURCE}.openai.azure.com/openai`,
    defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION },
    defaultHeaders: { 'api-key': AZURE_OPENAI_API_KEY },
  });

  try {
    const thread = await openai.beta.threads.create();

    console.log(thread);

    return Response.json({ thread: thread });
  } catch (e) {
    console.log(e);
    return Response.json({ error: e });
  }
}
