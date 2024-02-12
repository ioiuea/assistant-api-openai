import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_API_RESOURCE,
  AZURE_OPENAI_API_DEPLOYMENT
} from "@/const/default";
import { NextRequest } from "next/server";
import OpenAI from "openai";

interface AssistantToolsCode {
  type: "code_interpreter";
  // 他のプロパティ...
}

interface AssistantToolsRetrieval {
  type: "retrieval";
  // 他のプロパティ...
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const assistantName = searchParams.get("assistantName");
  const instructions = searchParams.get("instructions");
  const codeInterpreter = searchParams.get("code_interpreter") === 'true';
  const retrieval = searchParams.get("retrieval") === 'true';

  const openai = new OpenAI({
    apiKey: AZURE_OPENAI_API_KEY,
    baseURL: `https://${AZURE_OPENAI_API_RESOURCE}.openai.azure.com/openai`,
    defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION },
    defaultHeaders: { 'api-key': AZURE_OPENAI_API_KEY },
  });

  console.log('Assistant Name:', assistantName);
  console.log('Instructions:', instructions);

  const tools: (AssistantToolsCode | AssistantToolsRetrieval)[] = [];
  if (codeInterpreter) {
    tools.push({ type: "code_interpreter" } as AssistantToolsCode);
  }
  if (retrieval) {
    tools.push({ type: "retrieval" } as AssistantToolsRetrieval);
  }

  try {
    const assistant = await openai.beta.assistants.create({
      instructions: instructions,
      name: assistantName,
      tools: tools,
      model: AZURE_OPENAI_API_DEPLOYMENT,
    });

    console.log(assistant);

    return Response.json({ assistant: assistant });
  } catch (e) {
    console.log(e);
    return Response.json({ error: e });
  }
}