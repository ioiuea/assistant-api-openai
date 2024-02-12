import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_API_RESOURCE,
  AZURE_OPENAI_API_DEPLOYMENT
} from "@/const/default";
import OpenAI from "openai";

export async function GET() {
  // const apiKey = process.env['AZURE_OPENAI_API_KEY'];
  console.log(AZURE_OPENAI_API_KEY);
  console.log(AZURE_OPENAI_API_VERSION);
  console.log(AZURE_OPENAI_API_RESOURCE);
  console.log(AZURE_OPENAI_API_DEPLOYMENT);
  // const apiKey = "d94c728e7867411fb423c4eceeb28dc3"
  // console.log(apiKey);

  // const apiVersion = '2024-02-15-preview';
  // console.log(apiVersion);

  // const resource = 'aoai-sweden-central-ueda';
  // console.log(resource);

  // const openai = new OpenAI();

  const openai = new OpenAI({
    apiKey: AZURE_OPENAI_API_KEY,
    baseURL: `https://${AZURE_OPENAI_API_RESOURCE}.openai.azure.com/openai`,
    defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION },
    defaultHeaders: { 'api-key': AZURE_OPENAI_API_KEY },
  });

  try {
    // const response = await openai.beta.assistants.list({
    //   order: "desc",
    //   limit: 100,
    // });

    const response = await openai.beta.assistants.list({
      order: "desc",
      limit: 100,
    });

    const assistants = response.data;

    console.log(assistants);

    return Response.json({ assistants: assistants });
  } catch (e) {
    console.log(e);
    return Response.json({ error: e });
  }
}