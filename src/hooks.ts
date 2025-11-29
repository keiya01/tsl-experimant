import {
  useThree as useThreeImpl,
  useFrame as useFrameImpl,
  type RootState as RootStateImpl,
  type RenderCallback,
} from "@react-three/fiber";
import type { WebGPURenderer } from "three/webgpu";

export type RootState = RootStateImpl & {
  gl: WebGPURenderer;
};

export const useThree = <T = RootState>(
  ...args: Parameters<typeof useThreeImpl<T>>
) => {
  return useThreeImpl<T>(...args);
};

export const useFrame = (
  cb: (state: RootState, delta: number, frame?: XRFrame) => void,
  priority?: number
) => {
  return useFrameImpl(cb as RenderCallback, priority);
};
