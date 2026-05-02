import fs from "fs";
import path from "path";
import { prisma } from "../db/prisma";

const promptFileByKey: Record<string, string> = {
  director: "director.prompt.txt",
  "behavior-detector": "behavior-detector.prompt.txt",
  "stage-director": "stage-director.prompt.txt",
  leader: "leader.prompt.txt",
  coworker: "coworker.prompt.txt",
  client: "client.prompt.txt",
  "group-discussion": "group-discussion.prompt.txt",
  judge: "judge.prompt.txt"
};

function readPromptFile(key: string): string {
  const fileName = promptFileByKey[key];
  if (!fileName) {
    throw new Error(`未知提示词 key: ${key}`);
  }
  return fs.readFileSync(path.resolve(__dirname, "../prompts", fileName), "utf-8");
}

export async function getPromptContent(key: string): Promise<string> {
  try {
    const template = await prisma.promptTemplate.findFirst({
      where: { key, active: true },
      orderBy: { version: "desc" }
    });

    if (template?.content) {
      return template.content;
    }
  } catch (error) {
    console.warn(`读取数据库提示词失败，回退到本地文件: ${key}`, error);
  }

  return readPromptFile(key);
}
