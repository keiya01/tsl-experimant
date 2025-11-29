import { useCallback, useEffect, useMemo, useRef, type FC } from "react";
import {
  float,
  instancedArray,
  instanceIndex,
  positionLocal,
  uniform,
  varying,
  wgslFn,
} from "three/tsl";
import { Color, type Mesh } from "three/webgpu";
import { useThree } from "../hooks";
import { useFrame } from "@react-three/fiber";

export const ComputeInstancing: FC<{ count: number }> = ({ count }) => {
  const { nodes, uniforms } = useMemo(() => {
    const time = uniform(0);
    const vHeight = varying(float(0.0));
    const buffer = instancedArray(count, "vec3");

    const computeInstancePosition = wgslFn(`
      fn compute(
        buffer: ptr<storage, array<vec3f>, read_write>,
		    count: f32,
		    index: u32,
      ) -> void {
        let gridSize = u32(count);
        let gridWidth = u32(sqrt(count));
        let gridHeight = (gridSize + gridWidth - 1u) / gridWidth;

        if (index >= gridSize) {
          return;
        }

        let x = index % gridWidth;
        let z = index / gridWidth;

        let spacing = 0.6;
        let worldX = f32(x) * spacing - f32(gridWidth - 1u) * spacing * 0.5;
        let worldZ = f32(z) * spacing - f32(gridHeight - 1u) * spacing * 0.5;

        buffer[index] = vec3f(worldX, 0.0, worldZ);
      }
    `);

    const computeNode = computeInstancePosition({
      buffer: buffer,
      count: count,
      index: instanceIndex,
    }).compute(count);

    const updatePosition = wgslFn(`
      fn update(
        position: vec3f,
        time: f32,
        vHeight: ptr<private, f32>,
      ) -> vec3f {
        let waveSpeed = 5.0;
        let waveAmplitude = 0.5;
        let waveFrequencyX = 0.75;
        let waveFrequencyZ = 0.75;

        let waveOffset = sin(position.x * waveFrequencyX + position.z * waveFrequencyZ - time * waveSpeed) * waveAmplitude;
        let waveOffset2 = sin(-position.x * waveFrequencyX + position.z * waveFrequencyZ - time * waveSpeed) * waveAmplitude;
        let newY = position.y + (waveOffset + waveOffset2) / 2.0;
        *vHeight = newY;
        return vec3f(position.x, newY, position.z);
      }
    `);

    const positionNode = updatePosition({
      position: positionLocal.add(buffer.element(instanceIndex)),
      time: time,
      vHeight: vHeight,
    });

    const heightColor = wgslFn(`
      fn color(
        vHeight: f32,
      ) -> vec3f {
        let adjustedHeight = max(vHeight, 0.05);
        return vec3f(adjustedHeight, 1.0, 1.0);
      }
    `);

    const colorNode = heightColor({
      vHeight: vHeight,
    });

    return {
      nodes: {
        computeNode,
        positionNode,
        colorNode,
      },
      uniforms: {
        time,
      },
    };
  }, [count]);

  const { gl } = useThree();

  const compute = useCallback(async () => {
    try {
      await gl.computeAsync(nodes.computeNode);
    } catch (error) {
      console.error(error);
    }
  }, [nodes.computeNode, gl]);

  const meshRef = useRef<Mesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;
    compute();
  }, [compute]);

  useFrame(({ clock }) => {
    uniforms.time.value = clock.getElapsedTime();
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      castShadow
      receiveShadow
    >
      <icosahedronGeometry args={[0.3, 4]} />
      <meshPhongMaterial
        emissive={new Color("white").multiplyScalar(0.15)}
        shininess={400.0}
        positionNode={nodes.positionNode}
        colorNode={nodes.colorNode}
      />
    </instancedMesh>
  );
};
