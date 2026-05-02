import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { createInitialBlackboard } from "../src/services/blackboard.service";

const prisma = new PrismaClient();

const promptFiles = [
  ["director", "Director Agent", "director.prompt.txt"],
  ["behavior-detector", "BehaviorDetector Agent", "behavior-detector.prompt.txt"],
  ["stage-director", "StageDirector Agent", "stage-director.prompt.txt"],
  ["leader", "Leader NPC", "leader.prompt.txt"],
  ["coworker", "Coworker NPC", "coworker.prompt.txt"],
  ["client", "Client NPC", "client.prompt.txt"],
  ["group-discussion", "Group Discussion Agent", "group-discussion.prompt.txt"],
  ["judge", "Judge Agent", "judge.prompt.txt"]
] as const;

const taskCard = `现在是下午1:30。下午4点VP陈总要向CEO做Q3方案汇报。

目前最大的问题是：汇报中关键的三页数据可视化设计稿还没出来。数据已经有了，框架也有了，但没有设计稿，陈总没法向CEO呈现。

汇报负责人、协作资源方和具体执行者会从不同角度追问你的判断。

你需要在120分钟内形成一个可执行的应对，并在多方追问中说明你的判断、取舍和下一步。`;

const restaurantTaskCard = `你是珍味轩餐厅的值班经理。

今晚8号桌是重要客人宴请。第二道菜出现出品问题，问题菜品已经撤下，现场尚未失控。

客人、后厨学徒和后厨主管会从不同角度追问你的处理。

你需要在现场压力下做出判断，并说明你的取舍和下一步。`;

const scenarioADesc = "下午4点VP要向CEO汇报，但关键设计稿缺失。120分钟内你需要在汇报、协作资源和执行边界之间推动可汇报方案。";
const scenarioBDesc = "8号桌重要客人宴请中出现菜品问题。你需要处理现场影响、员工纠错、后厨协同和后续风险。";

const scenarioAOpening = {
  speaker: "陈总",
  role: "VP",
  content: "下午4点我要向CEO汇报Q3方案。你先说说：目前哪些数据是确认过的、哪些是assumption？设计那三页涉及苏姐那边资源和小秋执行，边界谁来定？"
};

const scenarioBOpening = {
  speaker: "刘总",
  role: "8号桌客人",
  content: "（沉默片刻）菜我已经不想说了。那个学徒在后巷站着，厨房那边也等着你说法。你告诉我，今晚这件事你打算怎么办。"
};

async function main() {
  await prisma.scenario.upsert({
    where: { id: "project_demo_crisis" },
    create: {
      id: "project_demo_crisis",
      title: "周三下午的会议室",
      description: scenarioADesc,
      backgroundForUser: taskCard,
      openingMessageJson: JSON.stringify(scenarioAOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "project_demo_crisis")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    },
    update: {
      title: "周三下午的会议室",
      description: scenarioADesc,
      backgroundForUser: taskCard,
      openingMessageJson: JSON.stringify(scenarioAOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "project_demo_crisis")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    }
  });

  await prisma.scenario.upsert({
    where: { id: "coffee_shop_complaint" },
    create: {
      id: "coffee_shop_complaint",
      title: "8号桌的客人",
      description: scenarioBDesc,
      backgroundForUser: restaurantTaskCard,
      openingMessageJson: JSON.stringify(scenarioBOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "coffee_shop_complaint")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    },
    update: {
      title: "8号桌的客人",
      description: scenarioBDesc,
      backgroundForUser: restaurantTaskCard,
      openingMessageJson: JSON.stringify(scenarioBOpening),
      initialBlackboardJson: JSON.stringify(createInitialBlackboard(15, "coffee_shop_complaint")),
      maxRound: 15,
      groupChatEnabled: true,
      groupChatRounds: JSON.stringify([]),
      status: "active"
    }
  });

  for (const [key, name, fileName] of promptFiles) {
    const content = fs.readFileSync(path.resolve(__dirname, "../src/prompts", fileName), "utf-8");
    await prisma.promptTemplate.upsert({
      where: { key },
      create: { key, name, content },
      update: { name, content, active: true }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
