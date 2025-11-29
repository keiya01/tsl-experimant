import type { Meta, StoryObj } from "@storybook/react-vite";

import { Displacement } from ".";
import { View } from "../View";

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: "Displacement",
  component: Displacement,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  argTypes: {
    position: { control: "object" },
    scaleDistortion: { control: "number" },
  },
  // Use `fn` to spy on the onClick arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#action-args
  // args: { onClick: fn() },
  render: ({ position, scaleDistortion }) => (
    <View>
      <Displacement position={position} scaleDistortion={scaleDistortion} />
    </View>
  ),
} satisfies Meta<typeof Displacement>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Basic: Story = {
  args: {
    position: [0, 0, 0],
    scaleDistortion: 0.05,
  },
};
