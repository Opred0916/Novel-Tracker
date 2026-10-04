import type { Database } from '../storage/database';

export type ImageOcrStatus = 'pending' | 'processing' | 'recognized' | 'empty' | 'failed';

export type ImageOcrProgress = { done: number; total: number; failed: number };

export type PendingImageOcr = { imageId: string; bookId: string; localPath: string };

const LINKED_IMAGE_SQL = `(
  EXISTS (SELECT 1 FROM highlight_images h WHERE h.image_id = a.id)
  OR EXISTS (SELECT 1 FROM note_images n WHERE n.image_id = a.id)
)`;

const now = () => new Date().toISOString();

export class SqliteImageOcrRepository {
  constructor(private readonly db: Database, private readonly nowFactory: () => string = now) {}

  async reconcile(recoverInterrupted = false): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async txn => {
      if (recoverInterrupted) {
        await txn.runAsync(
          `UPDATE image_ocr SET status = 'pending', updated_at = ?, error_code = NULL
           WHERE status = 'processing' AND image_id IN (
             SELECT a.id FROM image_assets a WHERE ${LINKED_IMAGE_SQL}
           )`,
          this.nowFactory(),
        );
      }
      await txn.runAsync(
        `INSERT OR IGNORE INTO image_ocr (image_id, status, recognized_text, updated_at, recognizer_version, error_code)
         SELECT a.id, 'pending', NULL, ?, NULL, NULL
         FROM image_assets a
         WHERE ${LINKED_IMAGE_SQL}`,
        this.nowFactory(),
      );
      await txn.runAsync(
        `DELETE FROM image_ocr
         WHERE image_id NOT IN (
           SELECT image_id FROM highlight_images
           UNION
           SELECT image_id FROM note_images
         )`,
      );
    });
  }

  async nextPending(): Promise<PendingImageOcr | null> {
    const row = await this.db.getFirstAsync<{ image_id: string; book_id: string; local_path: string }>(
      `SELECT a.id AS image_id, a.book_id, a.local_path
       FROM image_assets a JOIN image_ocr o ON o.image_id = a.id
       WHERE o.status = 'pending' AND ${LINKED_IMAGE_SQL}
       ORDER BY o.updated_at ASC, a.id ASC LIMIT 1`,
    );
    return row ? { imageId: row.image_id, bookId: row.book_id, localPath: row.local_path } : null;
  }

  async markProcessing(imageId: string): Promise<boolean> {
    const result = await this.db.runAsync(
      `UPDATE image_ocr SET status = 'processing', updated_at = ?, error_code = NULL
       WHERE image_id = ? AND status = 'pending'
       AND image_id IN (SELECT a.id FROM image_assets a WHERE ${LINKED_IMAGE_SQL})`,
      this.nowFactory(), imageId,
    );
    return Number(result.changes) > 0;
  }

  async finish(imageId: string, text: string, recognizerVersion: string): Promise<void> {
    const recognizedText = text.trim();
    await this.db.runAsync(
      `UPDATE image_ocr SET status = ?, recognized_text = ?, updated_at = ?, recognizer_version = ?, error_code = NULL
       WHERE image_id = ? AND status = 'processing'`,
      recognizedText ? 'recognized' : 'empty', recognizedText || null, this.nowFactory(), recognizerVersion, imageId,
    );
  }

  async fail(imageId: string, errorCode: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE image_ocr SET status = 'failed', recognized_text = NULL, updated_at = ?, error_code = ?
       WHERE image_id = ? AND status = 'processing'`,
      this.nowFactory(), errorCode.slice(0, 80), imageId,
    );
  }

  async retry(imageId: string): Promise<boolean> {
    const result = await this.db.runAsync(
      `UPDATE image_ocr SET status = 'pending', updated_at = ?, error_code = NULL
       WHERE image_id = ? AND status = 'failed'
       AND image_id IN (SELECT a.id FROM image_assets a WHERE ${LINKED_IMAGE_SQL})`,
      this.nowFactory(), imageId,
    );
    return Number(result.changes) > 0;
  }

  async resetProcessing(imageId: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE image_ocr SET status = 'pending', updated_at = ?, error_code = NULL
       WHERE image_id = ? AND status = 'processing'`,
      this.nowFactory(), imageId,
    );
  }

  async progress(bookId?: string): Promise<ImageOcrProgress> {
    const row = await this.db.getFirstAsync<{ total: number; done: number; failed: number }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN o.status IN ('recognized', 'empty', 'failed') THEN 1 ELSE 0 END) AS done,
         SUM(CASE WHEN o.status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM image_assets a JOIN image_ocr o ON o.image_id = a.id
       WHERE ${LINKED_IMAGE_SQL} ${bookId ? 'AND a.book_id = ?' : ''}`,
      ...(bookId ? [bookId] : []),
    );
    return { total: Number(row?.total ?? 0), done: Number(row?.done ?? 0), failed: Number(row?.failed ?? 0) };
  }
}
