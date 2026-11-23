import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ExperiencesCarousel from "./ExperiencesCarousel";

const meta = {
  title: "Páginas/Home/Experiências",
  component: ExperiencesCarousel,
  decorators: [(Story) => <div className="bg-[#111] p-6"><Story /></div>],
} satisfies Meta<typeof ExperiencesCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {};
