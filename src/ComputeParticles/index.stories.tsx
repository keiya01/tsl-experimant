import type { Meta, StoryObj } from "@storybook/react-vite";

import { ComputeParticles } from ".";
import { View } from "../View";

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: "ComputeParticles",
  component: ComputeParticles,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  argTypes: {
    count: { control: "number" },
  },
  // Use `fn` to spy on the onClick arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#action-args
  // args: { onClick: fn() },
  render: ({ count }) => (
    <View>
      <ComputeParticles count={count} />
    </View>
  ),
} satisfies Meta<typeof ComputeParticles>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Basic: Story = {
  args: {
    count: 3e5,
  },
};
