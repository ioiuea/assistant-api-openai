import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_API_RESOURCE
} from "@/const/default";
import { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm } from "formidable";
import OpenAI from "openai";
import { createReadStream, rename } from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("Upload runnin");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).end("Method Not Allowed");
    return;
  }

  const form = new IncomingForm({ keepExtensions: true });
  console.log(form)

  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(500).json({ error: "Error parsing the form data." });
      return;
    }

    console.log(files);

    try {
      const fileArray = Array.isArray(files.file) ? files.file : [files.file];
      const file = fileArray[0];
      // console.log(file)

      if (!file) {
        res.status(400).json({ error: "No file uploaded." });
        return;
      }

      const newPath = file.filepath.substring(0, file.filepath.lastIndexOf('/'));
      const newFilePath = `${newPath}/${file.originalFilename}`;
      rename(file.filepath, newFilePath, (err) => {
        if (err) {
          console.error("Error renaming the file:", err);
          return;
        }
      });

      // Create a ReadStream from the file
      // const fileStream = createReadStream(file.filepath);
      const fileStream = createReadStream(newFilePath);

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

      const response = await openai.files.create({
        file: fileStream, // Use the ReadStream for uploading
        purpose: "assistants",
      });

      res.status(200).json({ file: response });
    } catch (e) {
      res
        .status(500)
        .json({ error: e instanceof Error ? e.message : "Unknown error" });
    }
  });
}
