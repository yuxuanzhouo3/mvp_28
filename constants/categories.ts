import type { ComponentType } from "react";
import {
  TrendingUp,
  Briefcase,
  Code,
  Shield,
  Heart,
  Bot,
  Home,
  Users,
  GraduationCap,
  Plane,
  Search,
  Shirt,
  UtensilsCrossed,
  Palette,
  ShieldCheck,
  Scale,
  Film,
} from "lucide-react";

export interface MornGPTCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: ComponentType<any>;
}

export const mornGPTCategories: MornGPTCategory[] = [
  {
    id: "a",
    name: "Growth Advisory",
    icon: TrendingUp,
    description: "Business development and market analysis",
    color: "bg-blue-500",
  },
  {
    id: "b",
    name: "Interview/Job",
    icon: Briefcase,
    description: "Career development and interview prep",
    color: "bg-green-500",
  },
  {
    id: "c",
    name: "AI Coder",
    icon: Code,
    description: "Advanced coding assistant",
    color: "bg-purple-500",
  },
  {
    id: "d",
    name: "Content Detection",
    icon: Shield,
    description: "Fake content verification",
    color: "bg-red-500",
  },
  {
    id: "e",
    name: "Medical Advice",
    icon: Heart,
    description: "Health consultation AI",
    color: "bg-pink-500",
  },
  {
    id: "h",
    name: "Multi-GPT",
    icon: Bot,
    description:
      "Orchestrates multiple AI models to solve complex problems by breaking them into specialized tasks",
    color: "bg-indigo-500",
  },
  {
    id: "l",
    name: "AI Lawyer",
    icon: Scale,
    description: "Legal consultation and document review",
    color: "bg-emerald-500",
  },
  {
    id: "n",
    name: "Entertainment Advisor",
    icon: Film,
    description: "Movie, music, and entertainment recommendations",
    color: "bg-fuchsia-500",
  },
  {
    id: "o",
    name: "Housing",
    icon: Home,
    description: "Real estate and accommodation",
    color: "bg-orange-500",
  },
  {
    id: "p",
    name: "Person Matching",
    icon: Users,
    description: "Professional and personal matching",
    color: "bg-cyan-500",
  },
  {
    id: "q",
    name: "AI Teacher",
    icon: GraduationCap,
    description: "Personalized learning system",
    color: "bg-yellow-500",
  },
  {
    id: "r",
    name: "Travel Planning",
    icon: Plane,
    description: "Intelligent travel assistance",
    color: "bg-teal-500",
  },
  {
    id: "s",
    name: "Product Search",
    icon: Search,
    description: "Smart product recommendations",
    color: "bg-gray-500",
  },
  {
    id: "t",
    name: "Fashion",
    icon: Shirt,
    description: "Personalized styling advice",
    color: "bg-rose-500",
  },
  {
    id: "u",
    name: "Food & Dining",
    icon: UtensilsCrossed,
    description: "Restaurant and food discovery",
    color: "bg-amber-500",
  },
  {
    id: "w",
    name: "Content Generation",
    icon: Palette,
    description: "Creative content creation",
    color: "bg-violet-500",
  },
  {
    id: "z",
    name: "AI Protection",
    icon: ShieldCheck,
    description: "AI safety and security",
    color: "bg-slate-500",
  },
];
