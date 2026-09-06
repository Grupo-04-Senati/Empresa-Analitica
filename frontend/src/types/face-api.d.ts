declare module 'face-api.js' {
  export class TinyFaceDetectorOptions {
    constructor(options?: { inputSize?: number; scoreThreshold?: number });
  }

  export interface FaceDetection {
    box: { x: number; y: number; width: number; height: number };
    score: number;
  }

  export interface FaceLandmarks68 {
    positions: Array<{ x: number; y: number }>;
  }

  export interface WithFaceDetection<T> {
    detection: {
      box: { x: number; y: number; width: number; height: number };
      score: number;
    };
  }

  export type WithFaceLandmarks<T> = T & {
    landmarks: { positions: Array<{ x: number; y: number }> };
  };

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

  export function detectAllFaces(
    input: HTMLVideoElement | HTMLCanvasElement,
    options?: TinyFaceDetectorOptions
  ): {
    withFaceLandmarks(): {
      withFaceDescriptors(): Promise<Array<WithFaceDescriptor<WithFaceLandmarks<WithFaceDetection<{}>>>>>;
    };
  };
}
