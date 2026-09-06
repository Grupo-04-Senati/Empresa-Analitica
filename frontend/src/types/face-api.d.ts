declare module 'face-api.js' {
  export class TinyFaceDetectorOptions {
    constructor(options?: { inputSize?: number; scoreThreshold?: number });
  }

  export interface FaceDetection {
    detection: {
      box: { x: number; y: number; width: number; height: number };
      score: number;
    };
  }

  export interface FaceLandmarks {
    positions: Array<{ x: number; y: number }>;
  }

  export interface FaceDescriptor {
    descriptor: Float32Array;
  }

  export type WithFaceDetection<T> = T & { detection: FaceDetection['detection'] };
  export type WithFaceLandmarks<T> = T & { landmarks: FaceLandmarks };
  export type WithFaceDescriptor<T> = T & { descriptor: Float32Array };

  export const nets: {
    tinyFaceDetector: { loadFromUri(url: string): Promise<void> };
    faceLandmark68Net: { loadFromUri(url: string): Promise<void> };
    faceRecognitionNet: { loadFromUri(url: string): Promise<void> };
  };

  export function detectSingleFace(
    input: HTMLVideoElement | HTMLCanvasElement,
    options?: TinyFaceDetectorOptions
  ): {
    withFaceLandmarks(): {
      withFaceDescriptor(): Promise<WithFaceDescriptor<WithFaceLandmarks<WithFaceDetection<{}>>> | null>;
    };
  };
}
