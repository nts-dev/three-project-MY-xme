/// <reference types="vite/client" />
import '@react-three/fiber';
import { ReactThreeFiber } from '@react-three/fiber'; // 👈 This is the missing piece

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_FILE_URL: string;
  readonly VITE_LOCAL_FILE_URL: string;
  readonly VITE_JSON_URL: string;
  readonly VITE_DATA_URL: string;
  readonly VITE_VIDEO_URL: string;
  readonly VITE_ASSET_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: ReactThreeFiber.Object3DNode<THREE.Group, typeof THREE.Group>;
      // Add other Three.js elements as needed
    }
  }
}
