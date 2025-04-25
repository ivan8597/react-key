declare module 'three/examples/jsm/controls/OrbitControls' {
  import { Camera, Object3D } from 'three';
  export class OrbitControls {
    constructor(camera: Camera, domElement?: HTMLElement);
    enableDamping: boolean;
    dampingFactor: number;
    target: Object3D['position'];
    update(): void;
  }
}

declare module 'three/examples/jsm/loaders/GLTFLoader' {
  import { Object3D, Scene, AnimationClip } from 'three';
  export interface GLTF {
    scene: Scene;
    scenes: Scene[];
    animations: AnimationClip[];
    cameras: Camera[];
    asset: object;
  }
  export class GLTFLoader {
    constructor();
    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
  }
} 