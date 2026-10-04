import { ImageOcrWorker } from '../../src/books/imageOcrWorker';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(next => { resolve = next; });
  return { promise, resolve };
}

function repositoryFor(item: { imageId: string; bookId: string; localPath: string }) {
  return {
    nextPending: jest.fn().mockResolvedValueOnce(item).mockResolvedValue(null),
    markProcessing: jest.fn().mockResolvedValue(true),
    finish: jest.fn().mockResolvedValue(undefined),
    fail: jest.fn().mockResolvedValue(undefined),
    resetProcessing: jest.fn().mockResolvedValue(undefined),
    retry: jest.fn().mockResolvedValue(true),
  } as any;
}

test('processes one image at a time without blocking callers', async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const repository = repositoryFor({ imageId: 'one', bookId: 'book', localPath: 'file:///one.jpg' });
  repository.nextPending.mockReset()
    .mockResolvedValueOnce({ imageId: 'one', bookId: 'book', localPath: 'file:///one.jpg' })
    .mockResolvedValueOnce({ imageId: 'two', bookId: 'book', localPath: 'file:///two.jpg' })
    .mockResolvedValue(null);
  const recognizer = { isAvailable: () => true, recognize: jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) };
  const worker = new ImageOcrWorker(repository, recognizer);
  worker.resume();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(recognizer.recognize).toHaveBeenCalledTimes(1);
  first.resolve('第一张');
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(recognizer.recognize).toHaveBeenCalledTimes(2);
  second.resolve('第二张');
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(repository.finish).toHaveBeenCalledTimes(2);
});

test('pauses between images and retries failed work once', async () => {
  const repository = repositoryFor({ imageId: 'one', bookId: 'book', localPath: 'file:///one.jpg' });
  const recognizer = { isAvailable: () => true, recognize: jest.fn().mockRejectedValue(new Error('decode')) };
  const worker = new ImageOcrWorker(repository, recognizer);
  worker.resume();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(repository.fail).toHaveBeenCalledWith('one', 'recognition_failed');
  worker.pause();
  await worker.retry('one');
  expect(repository.retry).toHaveBeenCalledWith('one');
});

test('invalidating work discards an in-flight result before restore', async () => {
  const result = deferred<string>();
  const repository = repositoryFor({ imageId: 'one', bookId: 'book', localPath: 'file:///one.jpg' });
  const recognizer = { isAvailable: () => true, recognize: jest.fn().mockReturnValue(result.promise) };
  const worker = new ImageOcrWorker(repository, recognizer);
  worker.resume();
  await Promise.resolve();
  worker.invalidateAndPause();
  result.resolve('旧书库文字');
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(repository.finish).not.toHaveBeenCalled();
  expect(repository.resetProcessing).toHaveBeenCalledWith('one');
});

test('missing native OCR keeps the worker idle', async () => {
  const repository = repositoryFor({ imageId: 'one', bookId: 'book', localPath: 'file:///one.jpg' });
  const worker = new ImageOcrWorker(repository, { isAvailable: () => false, recognize: jest.fn() });
  worker.resume();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(repository.nextPending).not.toHaveBeenCalled();
});
