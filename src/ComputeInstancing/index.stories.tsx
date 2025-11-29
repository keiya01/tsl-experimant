import type { Meta, StoryObj } from "@storybook/react-vite";

import { ComputeInstancing } from ".";
import { View } from "../View";

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: "ComputeInstancing",
  component: ComputeInstancing,
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
      <ComputeInstancing count={count} />
    </View>
  ),
} satisfies Meta<typeof ComputeInstancing>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Basic: Story = {
  args: {
    count: 1e4,
  },
};
