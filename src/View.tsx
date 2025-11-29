import { Canvas } from "@react-three/fiber";
import type { FC, PropsWithChildren } from "react";
import type { WebGPURendererParameters } from "three/src/renderers/webgpu/WebGPURenderer.js";
import { WebGPURenderer } from "three/webgpu";
import { OrbitControls } from "@react-three/drei";
import "./extends";

export const View: FC<PropsWithChildren> = ({ children }) => (
  <Canvas
    style={{ width: "100vw", height: "100vh" }}
    shadows
    gl={async (props) => {
      const renderer = new WebGPURenderer({
        ...(props as WebGPURendererParameters),
        // forceWebGL: true,
      });
      await renderer.init();
      return renderer;
    }}
  >
    <color attach="background" args={["#333333"]} />
    <OrbitControls />
    <ambientLight intensity={2.5} />
    <directionalLight position={[10, 10, 10]} intensity={5} />
    {children}
  </Canvas>
);
