// API service functions
import { Message } from "../types";

export const simulateMultiGPTResponse = async (
  userPrompt: string
): Promise<Message> => {
  const subTasks = [
    {
      task: "Analyze the problem structure",
      model: "AI Coder (C1)",
      response: "Breaking down the problem into logical components...",
    },
    {
      task: "Research relevant information",
      model: "Growth Advisory (A1)",
      response: "Gathering market insights and strategic considerations...",
    },
    {
      task: "Generate creative solutions",
      model: "Content Generation (W1)",
      response: "Creating innovative approaches and alternatives...",
    },
  ];

  return {
    id: (Date.now() + 1).toString(),
    role: "assistant",
    content: `Multi-GPT Deep Analysis Complete!\n\nI've orchestrated multiple specialized AI models to provide comprehensive insights for: "${userPrompt}"\n\n${subTasks
      .map(
        (task, i) =>
          `${i + 1}. **${task.task}** (${task.model})\n   ${task.response}`
      )
      .join(
        "\n\n"
      )}\n\n**Final Synthesis:** Based on the combined expertise of multiple specialized models, here's my comprehensive response with deep thinking applied to your query.`,
    timestamp: new Date(),
    model: "Multi-GPT (H1)",
    isMultiGPT: true,
    subTasks,
  };
};
