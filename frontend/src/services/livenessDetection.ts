import * as faceapi from 'face-api.js';

interface FrameMeasurement {
  timestamp: number;
  ear: number | null;
  yaw: number | null;
}

interface LivenessResult {
  passed: boolean;
  method: 'blink' | 'yaw' | null;
  reason: string;
  earHistory: number[];
  yawHistory: number[];
}

const WINDOW_MS = 5000;
const BLINK_TRANSITION_MS = { min: 80, max: 500 };
const EAR_OPEN_THRESHOLD = 0.22;
const EAR_CLOSED_THRESHOLD = 0.14;
const YAW_DEVIATION_THRESHOLD = 0.20;
const YAW_RETURN_THRESHOLD = 0.10;
const MIN_VALID_FRAMES = 15;

export class LivenessDetector {
  private buffer: FrameMeasurement[] = [];
  private baselineYaw: number | null = null;
  private baselineFrames = 0;
  private isRunning = false;
  private animFrameId: number | null = null;
  private video: HTMLVideoElement | null = null;
  private onProgress: ((stage: string, detail: string) => void) | null = null;
  private onResult: ((result: LivenessResult) => void) | null = null;

  start(
    video: HTMLVideoElement,
    onProgress: (stage: string, detail: string) => void,
    onResult: (result: LivenessResult) => void
  ): void {
    this.video = video;
    this.onProgress = onProgress;
    this.onResult = onResult;
    this.buffer = [];
    this.baselineYaw = null;
    this.baselineFrames = 0;
    this.isRunning = true;
    this.loop();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop = (): void => {
    if (!this.isRunning || !this.video || this.video.readyState < 2) {
      if (this.isRunning) this.animFrameId = requestAnimationFrame(this.loop);
      return;
    }

    this.captureFrame().then(() => {
      this.pruneOldFrames();
      this.analyze();

      if (this.isRunning) {
        this.animFrameId = requestAnimationFrame(this.loop);
      }
    });
  };

  private async captureFrame(): Promise<void> {
    if (!this.video) return;

    try {
      const det = await (faceapi as any)
        .detectSingleFace(this.video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
        .withFaceLandmarks();

      const now = Date.now();
      let ear: number | null = null;
      let yaw: number | null = null;

      if (det && det.landmarks) {
        const pts = det.landmarks.positions;

        if (pts.length >= 48) {
          const leftEye = pts.slice(36, 42);
          const rightEye = pts.slice(42, 48);
          ear = this.calculateEAR(leftEye, rightEye);
        }

        if (pts.length >= 31) {
          yaw = this.calculateYaw(pts[30], pts[35], pts[39]);
        }
      }

      this.buffer.push({ timestamp: now, ear, yaw });

      if (this.baselineYaw === null && yaw !== null) {
        this.baselineFrames++;
        if (this.baselineFrames <= 10) {
          const current = this.baselineYaw ?? 0;
          this.baselineYaw = current + (yaw - current) / this.baselineFrames;
        }
      }
    } catch {}
  }

  private calculateEAR(eye: { x: number; y: number }[], otherEye: { x: number; y: number }[]): number {
    const calcEye = (e: { x: number; y: number }[]): number => {
      const v1 = Math.hypot(e[1].x - e[5].x, e[1].y - e[5].y);
      const v2 = Math.hypot(e[2].x - e[4].x, e[2].y - e[4].y);
      const h = Math.hypot(e[0].x - e[3].x, e[0].y - e[3].y);
      if (h < 1) return 0.25;
      return (v1 + v2) / (2.0 * h);
    };
    return (calcEye(eye) + calcEye(otherEye)) / 2;
  }

  private calculateYaw(
    noseTip: { x: number; y: number },
    rightInner: { x: number; y: number },
    leftInner: { x: number; y: number }
  ): number {
    const eyeCenterX = (leftInner.x + rightInner.x) / 2;
    const interEyeDist = Math.hypot(rightInner.x - leftInner.x, rightInner.y - leftInner.y);
    if (interEyeDist < 10) return 0;
    return (noseTip.x - eyeCenterX) / interEyeDist;
  }

  private pruneOldFrames(): void {
    const cutoff = Date.now() - WINDOW_MS;
    this.buffer = this.buffer.filter(f => f.timestamp >= cutoff);
  }

  private analyze(): void {
    if (!this.onProgress || !this.onResult) return;

    const validFrames = this.buffer.filter(f => f.ear !== null || f.yaw !== null);
    if (validFrames.length < MIN_VALID_FRAMES) {
      const earFrames = this.buffer.filter(f => f.ear !== null).length;
      const yawFrames = this.buffer.filter(f => f.yaw !== null).length;
      this.onProgress('collecting', `Capturando... (${validFrames.length}/${MIN_VALID_FRAMES})`);
      return;
    }

    const blinkDetected = this.detectBlinkTransition();
    if (blinkDetected) {
      this.onResult({
        passed: true,
        method: 'blink',
        reason: 'Parpadeo detectado',
        earHistory: this.buffer.filter(f => f.ear !== null).map(f => f.ear!),
        yawHistory: this.buffer.filter(f => f.yaw !== null).map(f => f.yaw!),
      });
      return;
    }

    const yawDetected = this.detectYawMovement();
    if (yawDetected) {
      this.onResult({
        passed: true,
        method: 'yaw',
        reason: 'Giro de cabeza detectado',
        earHistory: this.buffer.filter(f => f.ear !== null).map(f => f.ear!),
        yawHistory: this.buffer.filter(f => f.yaw !== null).map(f => f.yaw!),
      });
      return;
    }

    const yaw = this.buffer.filter(f => f.yaw !== null).map(f => f.yaw!);
    const lastYaw = yaw.length > 0 ? yaw[yaw.length - 1] : 0;
    this.onProgress('waiting', `Gire la cabeza o parpadee (yaw: ${lastYaw.toFixed(2)})`);
  }

  private detectBlinkTransition(): boolean {
    const earFrames = this.buffer
      .filter(f => f.ear !== null)
      .map(f => ({ t: f.timestamp, v: f.ear! }));

    if (earFrames.length < 6) return false;

    const openTransitions: { time: number; ear: number }[] = [];
    const closedTransitions: { time: number; ear: number }[] = [];

    for (let i = 1; i < earFrames.length; i++) {
      const prev = earFrames[i - 1];
      const curr = earFrames[i];

      if (prev.v > EAR_OPEN_THRESHOLD && curr.v <= EAR_CLOSED_THRESHOLD) {
        closedTransitions.push({ time: curr.t, ear: curr.v });
      }

      if (prev.v <= EAR_CLOSED_THRESHOLD && curr.v > EAR_OPEN_THRESHOLD) {
        openTransitions.push({ time: curr.t, ear: curr.v });
      }
    }

    for (const closeT of closedTransitions) {
      for (const openT of openTransitions) {
        const dt = openT.time - closeT.time;
        if (dt >= BLINK_TRANSITION_MS.min && dt <= BLINK_TRANSITION_MS.max) {
          return true;
        }
      }
    }

    return false;
  }

  private detectYawMovement(): boolean {
    if (this.baselineYaw === null) return false;

    const yawFrames = this.buffer
      .filter(f => f.yaw !== null)
      .map(f => ({ t: f.timestamp, v: f.yaw! }));

    if (yawFrames.length < 8) return false;

    let maxDeviation = 0;
    let returnedToCenter = false;

    for (const frame of yawFrames) {
      const deviation = Math.abs(frame.v - this.baselineYaw);
      if (deviation > maxDeviation) {
        maxDeviation = deviation;
      }

      if (maxDeviation > YAW_DEVIATION_THRESHOLD) {
        const recentFrames = yawFrames.filter(f => f.t > frame.t).slice(-5);
        for (const recent of recentFrames) {
          if (Math.abs(recent.v - this.baselineYaw) < YAW_RETURN_THRESHOLD) {
            returnedToCenter = true;
            break;
          }
        }
      }

      if (returnedToCenter) break;
    }

    return maxDeviation > YAW_DEVIATION_THRESHOLD && returnedToCenter;
  }
}
