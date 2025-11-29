import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type FC } from "react";
import {
  BackSide,
  BufferGeometry,
  Color,
  DoubleSide,
  MeshPhongMaterial,
  Mesh,
  Texture,
  WebGLRenderTarget,
  type Vector3,
  FrontSide,
} from "three";
import {
  abs,
  add,
  cameraPosition,
  clamp,
  cross,
  dot,
  float,
  Fn,
  If,
  length,
  max,
  mix,
  negate,
  normalize,
  normalLocal,
  normalWorld,
  positionLocal,
  positionWorld,
  pow,
  rand,
  sub,
  texture,
  transformNormalToView,
  uniform,
  uv,
  varying,
  vec3,
  viewportUV,
} from "three/tsl";
import { cnoise } from "../nodes";

export const Displacement: FC<{
  position: Vector3 | [x: number, y: number, z: number];
  scaleDistortion: number;
  lightPosition?: [x: number, y: number, z: number];
}> = ({ position, scaleDistortion, lightPosition = [10, 10, 10] }) => {
  const meshRef = useRef<Mesh<BufferGeometry, MeshPhongMaterial>>(null);
  const backgroundColorNode = useMemo(() => {
    const gradientNode = Fn(() => {
      const color1 = vec3(0.01, 0.22, 0.98);
      const color2 = vec3(0.36, 0.68, 1.0);
      const t = clamp(length(abs(uv().sub(0.5))), 0.0, 0.8);
      return mix(color1, color2, t);
    });

    const sphereColorNode = gradientNode();

    return sphereColorNode;
  }, []);

  const { nodes, uniforms, utils } = useMemo(() => {
    const time = uniform(0.0);
    const scaleDistortion = uniform(0.0);
    const vNormal = varying(vec3(), "vNormal");

    const lightVector = uniform(vec3());

    const updatePos = Fn(
      ([pos, time]: [
        pos: ReturnType<typeof float>,
        time: ReturnType<typeof float>,
      ]) => {
        const noise = cnoise(vec3(pos).add(vec3(time))).mul(scaleDistortion);
        return add(pos, noise);
      }
    );

    const orthogonal = Fn(() => {
      const pos = normalLocal;
      If(abs(pos.x).greaterThan(abs(pos.z)), () => {
        return normalize(vec3(negate(pos.y), pos.x, 0.0));
      });

      return normalize(vec3(0.0, negate(pos.z), pos.y));
    });

    const positionNode = Fn(() => {
      const pos = positionLocal;

      const updatedPos = updatePos(pos, time);
      const theta = float(0.001); // Smaller epsilon for better accuracy

      const vecTangent = orthogonal();
      const vecBiTangent = normalize(cross(normalLocal, vecTangent));

      const neighbour1 = pos.add(vecTangent.mul(theta));
      const neighbour2 = pos.add(vecBiTangent.mul(theta));

      const displacedNeighbour1 = updatePos(neighbour1, time);
      const displacedNeighbour2 = updatePos(neighbour2, time);

      const displacedTangent = displacedNeighbour1.sub(updatedPos);
      const displacedBitangent = displacedNeighbour2.sub(updatedPos);

      const normal = normalize(cross(displacedTangent, displacedBitangent));

      const displacedNormal = normal
        .dot(normalLocal)
        .lessThan(0.0)
        .select(normal.negate(), normal);
      vNormal.assign(displacedNormal);

      return updatedPos;
    })();

    const normalNode = Fn(() => {
      const normal = vNormal;
      return transformNormalToView(normal);
    })();

    const classicFresnel = Fn(
      ({
        viewVector,
        worldNormal,
        power,
      }: {
        viewVector: ReturnType<typeof vec3>;
        worldNormal: ReturnType<typeof vec3>;
        power: ReturnType<typeof float>;
      }) => {
        const cosTheta = abs(dot(viewVector, worldNormal));
        const inversefresnelFactor = sub(1.0, cosTheta);
        return pow(inversefresnelFactor, power);
      }
    );

    const sat = Fn(([col]: [col: ReturnType<typeof vec3>]) => {
      const W = vec3(0.2125, 0.7154, 0.0721);
      const intensity = vec3(dot(col, W));
      return mix(intensity, col, 1.265);
    });

    const refract = Fn(({ sceneTex }: { sceneTex: Texture }) => {
      const absorption = 0.1;
      const refractionIntensity = 0.25;
      const shininess = 100.0;
      const LOOP = 8;
      const noiseIntensity = 0.015;

      const refractNormal = normalWorld.xy
        .mul(sub(1.0, normalWorld.z.mul(0.85)))
        .add(0.05);

      const refractCol = vec3(0.0, 0.0, 0.0).toVar();

      for (let i = 0; i < LOOP; i++) {
        const noise = rand(viewportUV).mul(noiseIntensity);
        const slide = float(i).div(float(LOOP)).mul(0.18).add(noise);

        const refractUvR = viewportUV.sub(
          refractNormal
            .mul(slide.mul(1.0).add(refractionIntensity))
            .mul(absorption)
        );
        const refractUvG = viewportUV.sub(
          refractNormal
            .mul(slide.mul(2.5).add(refractionIntensity))
            .mul(absorption)
        );
        const refractUvB = viewportUV.sub(
          refractNormal
            .mul(slide.mul(4.0).add(refractionIntensity))
            .mul(absorption)
        );

        const red = texture(sceneTex, refractUvR).r;
        const green = texture(sceneTex, refractUvG).g;
        const blue = texture(sceneTex, refractUvB).b;

        refractCol.assign(refractCol.add(vec3(red, green, blue)));
      }

      refractCol.assign(refractCol.div(float(LOOP)));

      const viewVector = normalize(cameraPosition.sub(positionWorld));
      const normalVector = normalize(normalWorld);

      const halfVector = normalize(viewVector.add(lightVector));

      const NdotL = dot(normalVector, lightVector);
      const NdotH = dot(normalVector, halfVector);

      const kDiffuse = max(0.0, NdotL);

      const NdotH2 = NdotH.mul(NdotH);
      const kSpecular = pow(NdotH2, shininess);

      const fresnel = classicFresnel({
        viewVector: viewVector,
        worldNormal: normalVector,
        power: 5.0,
      });

      refractCol.assign(
        refractCol.add(kSpecular.add(kDiffuse).mul(0.01).add(fresnel))
      );

      return vec3(sat(refractCol));
    });

    return {
      nodes: {
        positionNode,
        normalNode,
      },
      uniforms: {
        time,
        scaleDistortion,
        lightVector,
      },
      utils: {
        refract,
      },
    };
  }, []);

  const [backRenderTarget] = useState(
    () =>
      new WebGLRenderTarget(
        window.innerWidth * window.devicePixelRatio,
        window.innerHeight * window.devicePixelRatio
      )
  );

  const [mainRenderTarget] = useState(
    () =>
      new WebGLRenderTarget(
        window.innerWidth * window.devicePixelRatio,
        window.innerHeight * window.devicePixelRatio
      )
  );

  useFrame((state) => {
    const { clock, gl, scene, camera } = state;

    uniforms.time.value = clock.getElapsedTime();

    if (!meshRef.current) return;

    meshRef.current.material.visible = false;
    gl.setRenderTarget(backRenderTarget);
    gl.render(scene, camera);

    meshRef.current.material.side = BackSide;
    meshRef.current.material.visible = true;

    meshRef.current.material.colorNode = utils.refract({
      sceneTex: backRenderTarget.texture,
    });

    gl.setRenderTarget(mainRenderTarget);
    gl.render(scene, camera);

    meshRef.current.material.side = FrontSide;

    meshRef.current.material.colorNode = utils.refract({
      sceneTex: mainRenderTarget.texture,
    });

    gl.setRenderTarget(null);
  });

  useEffect(() => {
    uniforms.scaleDistortion.value = scaleDistortion;
    uniforms.lightVector.value.set(
      lightPosition[0],
      lightPosition[1],
      lightPosition[2]
    );
  }, [uniforms, scaleDistortion, lightPosition]);

  return (
    <>
      <mesh>
        <sphereGeometry args={[500, 16, 16]} />
        <meshBasicMaterial colorNode={backgroundColorNode} side={DoubleSide} />
      </mesh>
      <mesh position={position} ref={meshRef}>
        <icosahedronGeometry args={[1.5, 200]} />
        <meshPhongMaterial
          color={new Color("white").multiplyScalar(1.2)}
          normalNode={nodes.normalNode}
          positionNode={nodes.positionNode}
        />
      </mesh>
    </>
  );
};
