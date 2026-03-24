export type ExpertModelId =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "h"
  | "l"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "w"
  | "z";

export type ExpertModelDefinition = {
  id: ExpertModelId;
  name: string;
  slug: string;
  cloudbaseCollection: string;
  supabaseTable: string;
};

export const EXPERT_MODELS: ExpertModelDefinition[] = [
  {
    id: "a",
    name: "Growth Advisory",
    slug: "growth_advisory",
    cloudbaseCollection: "mgx_a_growth_advisory",
    supabaseTable: "mgx_a_growth_advisory",
  },
  {
    id: "b",
    name: "Interview/Job",
    slug: "interview_job",
    cloudbaseCollection: "mgx_b_interview_job",
    supabaseTable: "mgx_b_interview_job",
  },
  {
    id: "c",
    name: "AI Coder",
    slug: "ai_coder",
    cloudbaseCollection: "mgx_c_ai_coder",
    supabaseTable: "mgx_c_ai_coder",
  },
  {
    id: "d",
    name: "Content Detection",
    slug: "content_detection",
    cloudbaseCollection: "mgx_d_content_detection",
    supabaseTable: "mgx_d_content_detection",
  },
  {
    id: "e",
    name: "Medical Advice",
    slug: "medical_advice",
    cloudbaseCollection: "mgx_e_medical_advice",
    supabaseTable: "mgx_e_medical_advice",
  },
  {
    id: "h",
    name: "Multi-GPT",
    slug: "multi_gpt",
    cloudbaseCollection: "mgx_h_multi_gpt",
    supabaseTable: "mgx_h_multi_gpt",
  },
  {
    id: "l",
    name: "AI Lawyer",
    slug: "ai_lawyer",
    cloudbaseCollection: "mgx_l_ai_lawyer",
    supabaseTable: "mgx_l_ai_lawyer",
  },
  {
    id: "n",
    name: "Entertainment Advisor",
    slug: "entertainment_advisor",
    cloudbaseCollection: "mgx_n_entertainment_advisor",
    supabaseTable: "mgx_n_entertainment_advisor",
  },
  {
    id: "o",
    name: "Housing",
    slug: "housing",
    cloudbaseCollection: "mgx_o_housing",
    supabaseTable: "mgx_o_housing",
  },
  {
    id: "p",
    name: "Person Matching",
    slug: "person_matching",
    cloudbaseCollection: "mgx_p_person_matching",
    supabaseTable: "mgx_p_person_matching",
  },
  {
    id: "q",
    name: "AI Teacher",
    slug: "ai_teacher",
    cloudbaseCollection: "mgx_q_ai_teacher",
    supabaseTable: "mgx_q_ai_teacher",
  },
  {
    id: "r",
    name: "Travel Planning",
    slug: "travel_planning",
    cloudbaseCollection: "mgx_r_travel_planning",
    supabaseTable: "mgx_r_travel_planning",
  },
  {
    id: "s",
    name: "Product Search",
    slug: "product_search",
    cloudbaseCollection: "mgx_s_product_search",
    supabaseTable: "mgx_s_product_search",
  },
  {
    id: "t",
    name: "Fashion",
    slug: "fashion",
    cloudbaseCollection: "mgx_t_fashion",
    supabaseTable: "mgx_t_fashion",
  },
  {
    id: "u",
    name: "Food & Dining",
    slug: "food_dining",
    cloudbaseCollection: "mgx_u_food_dining",
    supabaseTable: "mgx_u_food_dining",
  },
  {
    id: "w",
    name: "Content Generation",
    slug: "content_generation",
    cloudbaseCollection: "mgx_w_content_generation",
    supabaseTable: "mgx_w_content_generation",
  },
  {
    id: "z",
    name: "AI Protection",
    slug: "ai_protection",
    cloudbaseCollection: "mgx_z_ai_protection",
    supabaseTable: "mgx_z_ai_protection",
  },
];

const expertIdSet = new Set(EXPERT_MODELS.map((m) => m.id));

export function isExpertModelId(value: unknown): value is ExpertModelId {
  return typeof value === "string" && expertIdSet.has(value as ExpertModelId);
}

export function getExpertModelDefinition(expertModelId: ExpertModelId) {
  const found = EXPERT_MODELS.find((m) => m.id === expertModelId);
  if (!found) {
    throw new Error(`Unknown expert model id: ${expertModelId}`);
  }
  return found;
}
