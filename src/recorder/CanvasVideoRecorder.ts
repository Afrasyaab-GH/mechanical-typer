/**
 * WebGL Canvas & Web Audio MediaRecorder Engine.
 * Captures 60 FPS 3D canvas viewport rendering synchronized with
 * the mechanical procedural audio stream (clicks, bell, carriage returns).
 */

export type RecorderStatus = "idle" | "recording" | "paused" | "stopped";

export interface RecorderOptions {
  fps?: number;
  videoBitrate?: number;
  mimeType?: string;
}

export class CanvasVideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private videoBlob: Blob | null = null;
  private videoUrl: string | null = null;
  private status: RecorderStatus = "idle";
  private startTime = 0;
  private durationSeconds = 0;
  private timerInterval: number | null = null;
  private streamDestination: MediaStreamAudioDestinationNode | null = null;
  private statusListeners: Array<(status: RecorderStatus) => void> = [];
  private tickListeners: Array<(durationSec: number) => void> = [];

  constructor() {
    // Singleton pattern or instance usage
  }

  getStatus(): RecorderStatus {
    return this.status;
  }

  isRecording(): boolean {
    return this.status === "recording";
  }

  hasRecording(): boolean {
    return this.videoBlob !== null && this.videoBlob.size > 0;
  }

  getVideoBlob(): Blob | null {
    return this.videoBlob;
  }

  getVideoUrl(): string | null {
    return this.videoUrl;
  }

  getDuration(): number {
    return this.durationSeconds;
  }

  onStatusChange(cb: (status: RecorderStatus) => void): () => void {
    this.statusListeners.push(cb);
    return () => {
      this.statusListeners = this.statusListeners.filter((fn) => fn !== cb);
    };
  }

  onTick(cb: (durationSec: number) => void): () => void {
    this.tickListeners.push(cb);
    return () => {
      this.tickListeners = this.tickListeners.filter((fn) => fn !== cb);
    };
  }

  private setStatus(status: RecorderStatus): void {
    this.status = status;
    for (const cb of this.statusListeners) cb(status);
  }

  private getSupportedMimeType(): string {
    const types = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=h264,opus",
      "video/webm",
      "video/mp4",
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "video/webm";
  }

  /**
   * Starts capturing 60 FPS video from canvas and mixing audio from the Web Audio context.
   */
  start(
    canvas: HTMLCanvasElement,
    audio?: { ctx: AudioContext | null; master: GainNode | null },
    options: RecorderOptions = {},
  ): boolean {
    if (this.status === "recording") return true;

    try {
      if (!canvas || typeof canvas.captureStream !== "function") {
        console.warn("Canvas.captureStream is not supported in this environment.");
        return false;
      }

      const fps = options.fps ?? 60;
      const canvasStream = canvas.captureStream(fps);
      const combinedStream = new MediaStream();

      // 1. Add video track from 3D Canvas
      const videoTracks = canvasStream.getVideoTracks();
      if (videoTracks.length > 0) {
        combinedStream.addTrack(videoTracks[0]);
      } else {
        console.warn("No video tracks found from canvas.");
        return false;
      }

      // 2. Connect Web Audio Destination if AudioContext and master GainNode are available
      if (audio?.ctx && audio?.master) {
        try {
          if (audio.ctx.state === "suspended") {
            void audio.ctx.resume();
          }
          this.streamDestination = audio.ctx.createMediaStreamDestination();
          audio.master.connect(this.streamDestination);
          const audioTracks = this.streamDestination.stream.getAudioTracks();
          if (audioTracks.length > 0) {
            combinedStream.addTrack(audioTracks[0]);
          }
        } catch (err) {
          console.warn("Could not attach audio track to video stream:", err);
        }
      }

      const mimeType = options.mimeType ?? this.getSupportedMimeType();
      const videoBitrate = options.videoBitrate ?? 6000000; // 6 Mbps for crisp 60 FPS

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: videoBitrate,
      });

      this.recordedChunks = [];
      this.videoBlob = null;
      if (this.videoUrl) {
        URL.revokeObjectURL(this.videoUrl);
        this.videoUrl = null;
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      recorder.onstart = () => {
        this.startTime = performance.now();
        this.durationSeconds = 0;
        this.setStatus("recording");

        if (this.timerInterval) window.clearInterval(this.timerInterval);
        this.timerInterval = window.setInterval(() => {
          this.durationSeconds = Math.floor((performance.now() - this.startTime) / 1000);
          for (const cb of this.tickListeners) cb(this.durationSeconds);
        }, 500);
      };

      recorder.onerror = (err) => {
        console.error("MediaRecorder error:", err);
        this.stop();
      };

      recorder.start(1000); // 1-second timeslices for reliable streaming
      this.mediaRecorder = recorder;
      return true;
    } catch (err) {
      console.error("Failed to start canvas video recorder:", err);
      this.setStatus("idle");
      return false;
    }
  }

  /**
   * Stops recording and resolves with the final Blob.
   */
  async stop(): Promise<Blob | null> {
    if (!this.mediaRecorder || this.status !== "recording") {
      return this.videoBlob;
    }

    if (this.timerInterval) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.durationSeconds = Math.max(1, Math.floor((performance.now() - this.startTime) / 1000));

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        this.setStatus("stopped");
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || "video/webm";
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.videoBlob = blob;
        if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
        this.videoUrl = URL.createObjectURL(blob);
        this.setStatus("stopped");
        resolve(blob);
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        console.warn("Error calling mediaRecorder.stop():", err);
        this.setStatus("stopped");
        resolve(null);
      }
    });
  }

  /**
   * Triggers automatic browser download of the recorded WebM file.
   */
  download(filename?: string): void {
    if (!this.videoBlob) return;
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = new Date();
    const defaultName = `Platen_ProofOfAuthorship_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}.webm`;

    const name = filename || defaultName;
    const url = this.videoUrl || URL.createObjectURL(this.videoBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  reset(): void {
    if (this.timerInterval) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.mediaRecorder && this.status === "recording") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    if (this.videoUrl) {
      URL.revokeObjectURL(this.videoUrl);
      this.videoUrl = null;
    }
    this.videoBlob = null;
    this.recordedChunks = [];
    this.durationSeconds = 0;
    this.setStatus("idle");
  }
}

// Global shared singleton
let recorderInstance: CanvasVideoRecorder | null = null;

export function getCanvasVideoRecorder(): CanvasVideoRecorder {
  if (!recorderInstance) {
    recorderInstance = new CanvasVideoRecorder();
  }
  return recorderInstance;
}
