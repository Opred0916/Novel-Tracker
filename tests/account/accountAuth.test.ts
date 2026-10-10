import { AccountAuthService } from '../../src/account/accountAuth';

const auth = {
  signInWithOtp: jest.fn(),
  verifyOtp: jest.fn(),
  signOut: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

test('sends a numeric email code without a redirect link', async () => {
  auth.signInWithOtp.mockResolvedValue({ error: null });
  const service = new AccountAuthService(auth);
  await service.sendCode(' Reader@Example.com ');
  expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'reader@example.com', options: { shouldCreateUser: true } });
});

test('verifies the provider email code', async () => {
  auth.verifyOtp.mockResolvedValue({ error: null });
  const service = new AccountAuthService(auth);
  await service.verifyCode('reader@example.com', ' 63376990 ');
  expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'reader@example.com', token: '63376990', type: 'email' });
});

test('rejects invalid input without network calls', async () => {
  const service = new AccountAuthService(auth);
  await expect(service.sendCode('not-email')).rejects.toThrow('邮箱格式');
  await expect(service.verifyCode('reader@example.com', '123')).rejects.toThrow('验证码');
  expect(auth.signInWithOtp).not.toHaveBeenCalled();
  expect(auth.verifyOtp).not.toHaveBeenCalled();
});

test('surfaces provider errors and signs out locally only', async () => {
  auth.verifyOtp.mockResolvedValue({ error: { message: 'Token expired' } });
  auth.signOut.mockResolvedValue({ error: null });
  const service = new AccountAuthService(auth);
  await expect(service.verifyCode('reader@example.com', '123456')).rejects.toThrow('Token expired');
  await service.signOut();
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});
