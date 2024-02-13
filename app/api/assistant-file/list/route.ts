import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_API_RESOURCE
} from "@/const/default";
import { NextRequest } from "next/server";
import OpenAI from "openai";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const assistantId = searchParams.get("assistantId");

  if (!assistantId)
    return Response.json({ error: "No id provided" }, { status: 400 });

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
    const assistantFiles = await openai.beta.assistants.files.list(assistantId);
    const newData = [];

    for (const file of assistantFiles.data) {
      const fileDetail = await openai.files.retrieve(file.id);
      const newFile = {
        ...file,
        name: fileDetail.filename
      };
      newData.push(newFile);
    }

    assistantFiles.data = newData;

    console.log(assistantFiles);
    console.log(assistantFiles.data);

    return Response.json({ assistantFiles: assistantFiles });
  } catch (e) {
    console.log(e);
    return Response.json({ error: e });
  }
}
