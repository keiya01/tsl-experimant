import { useEffect, useMemo, useRef, type FC } from "react";
import {
  abs,
  add,
  clamp,
  cos,
  directionToColor,
  float,
  Fn,
  hash,
  instanceIndex,
  int,
  length,
  luminance,
  mat3,
  mix,
  mrt,
  nodeObject,
  normalView,
  output,
  pass,
  perspectiveDepthToViewZ,
  sin,
  texture,
  textureStore,
  uv,
  uvec2,
  vec2,
  vec3,
  vec4,
  viewZToOrthographicDepth,
  type ShaderNodeObject,
} from "three/tsl";
import {
  BackSide,
  Node,
  TempNode,
  PostProcessing as PostProcessingImpl,
  TextureNode,
  Texture,
  StorageTexture,
} from "three/webgpu";
import { useThree, useFrame } from "../hooks";

class CustomEffectNode<T extends Node> extends TempNode {
  inputNode: ShaderNodeObject<T>;
  storageTexture: Texture;
  constructor(inputNode: ShaderNodeObject<T>, storageTexture: Texture) {
    super("vec4");
    this.inputNode = inputNode;
    this.storageTexture = storageTexture;
  }

  setup() {
    const inputNode = this.inputNode;
    const storageTexture = this.storageTexture;

    const effect = Fn(() => {
      const input = inputNode;

      const outlineColor = vec4(0.0, 0.0, 0.0, 1.0);
      const magnitude = texture(storageTexture, uv()).r;

      const finalColor = mix(input, outlineColor, magnitude);

      return vec4(finalColor.r, finalColor.g, finalColor.b, 1.0);
    });

    const outputNode = effect();

    return outputNode;
  }
}

const customPass = <T extends Node>(
  node: ShaderNodeObject<T>,
  storageTexture: Texture
) => nodeObject(new CustomEffectNode(node, storageTexture));

export const PostProcessing: FC = () => {
  const { gl, scene, camera } = useThree();

  const { backgroundNodes } = useMemo(() => {
    const gradientNode = Fn(() => {
      const color1 = vec3(0.01, 0.22, 0.98);
      const color2 = vec3(0.36, 0.68, 1.0);
      const t = clamp(length(abs(uv().sub(0.5))), 0.0, 0.8);
      return mix(color1, color2, t);
    });

    const sphereColorNode = gradientNode();

    return {
      backgroundNodes: {
        sphereColorNode,
      },
    };
  }, []);

  const { outputNode, depthTexture, normalTexture } = useMemo(() => {
    const scenePass = pass(scene, camera).setMRT(
      mrt({
        output: output, // Need to set `output`.
        normal: directionToColor(normalView),
      })
    );
    const scenePassColor = scenePass.getTextureNode("output");
    const depthTexture = scenePass.getTextureNode("depth");
    const normalTexture = scenePass.getTextureNode("normal");

    const outputNode = scenePassColor;

    return {
      outputNode,
      depthTexture,
      normalTexture,
    };
  }, [scene, camera]);

  const { nodes, buffers } = useMemo(() => {
    const storageTexture = new StorageTexture(
      window.innerWidth * window.devicePixelRatio,
      window.innerHeight * window.devicePixelRatio
    );

    const computeTexture = Fn(
      ({
        storageTexture,
        depthTexture,
        normalTexture,
      }: {
        storageTexture: Texture;
        depthTexture: ShaderNodeObject<TextureNode>;
        normalTexture: ShaderNodeObject<TextureNode>;
      }) => {
        const posX = instanceIndex.mod(
          int(window.innerWidth * window.devicePixelRatio)
        );

        const posY = instanceIndex.div(
          window.innerWidth * window.devicePixelRatio
        );

        const fragCoord = uvec2(posX, posY);

        const cameraNear = float(0.1);
        const cameraFar = float(1000.0);

        const readDepth = (
          depthTexture: ShaderNodeObject<TextureNode>,
          coord: Node
        ) => {
          // Need to use `TextureNode.sample(uv)` or `texture(Texture, uv)`.
          const fragCoordZ = depthTexture.sample(coord);
          const viewZ = perspectiveDepthToViewZ(
            fragCoordZ,
            cameraNear,
            cameraFar
          );
          return viewZToOrthographicDepth(viewZ, cameraNear, cameraFar);
        };

        const outlineThickness = 1.675 * window.devicePixelRatio;

        const uvCoord = vec2(
          float(fragCoord.x).div(
            float(window.innerWidth * window.devicePixelRatio)
          ),
          float(fragCoord.y).div(
            float(window.innerHeight * window.devicePixelRatio)
          )
        );

        const frequency = 0.08;
        const displacement = vec2(
          hash(vec2(float(fragCoord.x), float(fragCoord.y))).mul(
            sin(float(fragCoord.y).mul(frequency))
          ),

          hash(vec2(float(fragCoord.x), float(fragCoord.y))).mul(
            cos(float(fragCoord.x).mul(frequency))
          )
        )
          .mul(1.2)
          .div(
            vec2(
              window.innerWidth * window.devicePixelRatio,
              window.innerHeight * window.devicePixelRatio
            )
          );

        const texel = vec2(
          1.0 / (window.innerWidth * window.devicePixelRatio),
          1.0 / (window.innerHeight * window.devicePixelRatio)
        ).mul(outlineThickness);

        const Gx = mat3(-1, -2, -1, 0, 0, 0, 1, 2, 1);
        const Gy = mat3(-1, 0, 1, -2, 0, 2, -1, 0, 1);

        const depth0y0 = luminance(
          readDepth(
            depthTexture,
            uvCoord.add(displacement).add(texel.mul(vec2(-1.0, 1.0)))
          )
        );
        const depth0y1 = luminance(
          readDepth(
            depthTexture,
            uvCoord.add(displacement).add(texel.mul(vec2(-1.0, 0.0)))
          )
        );
        const depth0y2 = luminance(
          readDepth(
            depthTexture,
            uvCoord.add(displacement).add(texel.mul(vec2(-1.0, -1.0)))
          )
        );

        const depth1y0 = luminance(
          readDepth(
            depthTexture,
            uvCoord.add(displacement).add(texel.mul(vec2(0.0, -1.0)))
          )
        );
        const depth1y1 = luminance(
          readDepth(
            depthTexture,
            uvCoord.add(displacement).add(texel.mul(vec2(0.0, 0.0)))
          )
        );
        const depth1y2 = luminance(
          readDepth(
            depthTexture,
            uvCoord.add(displacement).add(texel.mul(vec2(0.0, 1.0)))
          )
        );

        const depth2y0 = luminance(
          readDepth(
            depthTexture,
            uvCoord.add(displacement).add(texel.mul(vec2(1.0, -1.0)))
          )
        );
        const depth2y1 = luminance(
          readDepth(
            depthTexture,
            uvCoord.add(displacement).add(texel.mul(vec2(1.0, 0.0)))
          )
        );
        const depth2y2 = luminance(
          readDepth(
            depthTexture,
            uvCoord.add(displacement).add(texel.mul(vec2(1.0, 1.0)))
          )
        );

        const valueGx = add(
          Gx[0][0].mul(depth0y0),
          Gx[1][0].mul(depth0y1),
          Gx[2][0].mul(depth0y2),
          Gx[0][1].mul(depth1y0),
          Gx[1][1].mul(depth1y1),
          Gx[2][1].mul(depth1y2),
          Gx[0][2].mul(depth2y0),
          Gx[1][2].mul(depth2y1),
          Gx[2][2].mul(depth2y2)
        );

        const valueGy = add(
          Gy[0][0].mul(depth0y0),
          Gy[1][0].mul(depth0y1),
          Gy[2][0].mul(depth0y2),
          Gy[0][1].mul(depth1y0),
          Gy[1][1].mul(depth1y1),
          Gy[2][1].mul(depth1y2),
          Gy[0][2].mul(depth2y0),
          Gy[1][2].mul(depth2y1),
          Gy[2][2].mul(depth2y2)
        );

        const GDepth = valueGx.mul(valueGx).add(valueGy.mul(valueGy)).sqrt();

        const normal0y0 = luminance(
          normalTexture.sample(
            uvCoord.add(displacement).add(texel.mul(vec2(-1.0, 1.0)))
          ).rgb
        );
        const normal0y1 = luminance(
          normalTexture.sample(
            uvCoord.add(displacement).add(texel.mul(vec2(-1.0, 0.0)))
          ).rgb
        );
        const normal0y2 = luminance(
          normalTexture.sample(
            uvCoord.add(displacement).add(texel.mul(vec2(-1.0, -1.0)))
          ).rgb
        );

        const normal1y0 = luminance(
          normalTexture.sample(
            uvCoord.add(displacement).add(texel.mul(vec2(0.0, -1.0)))
          ).rgb
        );
        const normal1y1 = luminance(
          normalTexture.sample(
            uvCoord.add(displacement).add(texel.mul(vec2(0.0, 0.0)))
          ).rgb
        );
        const normal1y2 = luminance(
          normalTexture.sample(
            uvCoord.add(displacement).add(texel.mul(vec2(0.0, 1.0)))
          ).rgb
        );

        const normal2y0 = luminance(
          normalTexture.sample(
            uvCoord.add(displacement).add(texel.mul(vec2(1.0, -1.0)))
          ).rgb
        );
        const normal2y1 = luminance(
          normalTexture.sample(
            uvCoord.add(displacement).add(texel.mul(vec2(1.0, 0.0)))
          ).rgb
        );
        const normal2y2 = luminance(
          normalTexture.sample(
            uvCoord.add(displacement).add(texel.mul(vec2(1.0, 1.0)))
          ).rgb
        );

        const valueGxNormal = add(
          Gx[0][0].mul(normal0y0),
          Gx[1][0].mul(normal0y1),
          Gx[2][0].mul(normal0y2),
          Gx[0][1].mul(normal1y0),
          Gx[1][1].mul(normal1y1),
          Gx[2][1].mul(normal1y2),
          Gx[0][2].mul(normal2y0),
          Gx[1][2].mul(normal2y1),
          Gx[2][2].mul(normal2y2)
        );

        const valueGyNormal = add(
          Gy[0][0].mul(normal0y0),
          Gy[1][0].mul(normal0y1),
          Gy[2][0].mul(normal0y2),
          Gy[0][1].mul(normal1y0),
          Gy[1][1].mul(normal1y1),
          Gy[2][1].mul(normal1y2),
          Gy[0][2].mul(normal2y0),
          Gy[1][2].mul(normal2y1),
          Gy[2][2].mul(normal2y2)
        );

        const GNormal = valueGxNormal
          .mul(valueGxNormal)
          .add(valueGyNormal.mul(valueGyNormal))
          .sqrt();

        const magnitude = GDepth.add(GNormal);

        textureStore(storageTexture, fragCoord, vec4(magnitude, 0.0, 0.0, 1.0));
      }
    );

    const computeNode = computeTexture({
      storageTexture: storageTexture,
      depthTexture: depthTexture,
      normalTexture: normalTexture,
    }).compute(
      window.innerWidth *
        window.devicePixelRatio *
        window.innerHeight *
        window.devicePixelRatio
    );

    return {
      nodes: {
        computeNode,
      },
      buffers: {
        storageTexture,
      },
    };
  }, [depthTexture, normalTexture]);

  const postProcessingRef = useRef<PostProcessingImpl>(null);

  useFrame(({ gl }) => {
    gl.computeAsync(nodes.computeNode);
  });

  useEffect(() => {
    const postProcessing = new PostProcessingImpl(gl);
    // Output normal
    // postProcessing.outputNode = Fn(() => {
    //   const finalColor = normalTexture.sample(uv());
    //   return vec4(finalColor.r, finalColor.g, finalColor.b, 1.0);
    // })();
    postProcessing.outputNode = customPass(outputNode, buffers.storageTexture);
    postProcessingRef.current = postProcessing;

    return () => {
      postProcessingRef.current = null;
    };
  }, [gl, outputNode, buffers]);

  useFrame(() => {
    if (postProcessingRef.current) {
      postProcessingRef.current.render();
    }
  }, 1);

  return (
    <>
      <mesh>
        <sphereGeometry args={[50, 16, 16]} />
        <meshBasicMaterial
          colorNode={backgroundNodes.sphereColorNode}
          side={BackSide}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[1, 1]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </>
  );
};
