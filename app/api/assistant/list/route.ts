import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_API_RESOURCE,
  AZURE_OPENAI_API_DEPLOYMENT
} from "@/const/default";
import OpenAI from "openai";

export async function GET() {

  let openai;
  if (process.env.AZURE_OPENAI_API === 'true') {
    openai = new OpenAI({
      apiKey: AZURE_OPENAI_API_KEY,
      baseURL: AZURE_OPENAI_API_RESOURCE,
      defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION },
      defaultHeaders: { 'api-key': AZURE_OPENAI_API_KEY },
    });
  } else {
    openai = new OpenAI();
  }

  try {
    const response = await openai.beta.assistants.list({
      order: "desc",
      limit: 100,
    });

    const assistants = response.data;

    // console.log(assistants);

    return Response.json({ assistants: assistants });
  } catch (e) {
    console.log(e);
    return Response.json({ error: e });
  }
}