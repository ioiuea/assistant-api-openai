import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_API_ENDPOINT
} from "@/const/default";
import { NextRequest } from "next/server";
import OpenAI from "openai";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const assistantId = searchParams.get("assistantId");
  const fileId = searchParams.get("fileId");

  if (!assistantId)
    return Response.json(
      { error: "No assistant id provided" },
      { status: 400 }
    );
  if (!fileId)
    return Response.json({ error: "No file id provided" }, { status: 400 });

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
    const deletedFile = await openai.beta.assistants.files.del(
      assistantId,
      fileId
    );

    // console.log(deletedFile);

    return Response.json(deletedFile);
  } catch (e) {
    console.log(e);
    return Response.json({ error: e });
  }
}
