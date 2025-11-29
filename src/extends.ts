import { extend, type ConstructorRepresentation } from "@react-three/fiber";
import * as THREE from "three/webgpu";

extend(THREE as unknown as ConstructorRepresentation);
