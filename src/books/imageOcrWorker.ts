import type { LocalImageTextRecognizer } from './localImageTextRecognizer';
import type { PendingImageOcr, SqliteImageOcrRepository } from './imageOcrRepository';

type WorkerRepository = Pick<SqliteImageOcrRepository, 'nextPending' | 'markProcessing' | 'finish' | 'fail' | 'retry' | 'resetProcessing'>;

const RECOGNIZER_VERSION = 'local-1';

export class ImageOcrWorker {
  private running = false;
  private pumping = false;
  private generation = 0;

  constructor(private readonly repository: WorkerRepository, private readonly recognizer: LocalImageTextRecognizer) {}

  resume(): void {
    this.running = true;
    this.kick();
  }

  pause(): void {
    this.running = false;
  }

  invalidateAndPause(): void {
    this.running = false;
    this.generation += 1;
  }

  kick(): void {
    if (!this.running || this.pumping || !this.recognizer.isAvailable()) return;
    this.pumping = true;
    const generation = this.generation;
    void this.pump(generation).finally(() => {
      this.pumping = false;
    });
  }

  async retry(imageId: string): Promise<void> {
    if (await this.repository.retry(imageId)) this.kick();
  }

  private async pump(generation: number): Promise<void> {
    while (this.running && generation === this.generation) {
      const item = await this.repository.nextPending();
      if (!item || generation !== this.generation || !this.running) return;
      if (!await this.repository.markProcessing(item.imageId)) continue;
      try {
        const text = await this.recognizer.recognize(item.localPath);
        if (generation !== this.generation || !this.running) {
          await this.repository.resetProcessing(item.imageId);
          return;
        }
        await this.repository.finish(item.imageId, text, RECOGNIZER_VERSION);
      } catch (error) {
        if (generation !== this.generation || !this.running) {
          await this.repository.resetProcessing(item.imageId);
          return;
        }
        const errorCode = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'recognition_failed';
        await this.repository.fail(item.imageId, errorCode);
      }
    }
  }
}

export type { PendingImageOcr };
