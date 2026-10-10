type AuthResponse = Promise<{ error: { message: string } | null }>;
type AuthClient = {
  signInWithOtp(input: { email: string; options: { shouldCreateUser: true } }): AuthResponse;
  verifyOtp(input: { email: string; token: string; type: 'email' }): AuthResponse;
  signOut(input: { scope: 'local' }): AuthResponse;
};

function normalizedEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('邮箱格式不正确');
  return email;
}

async function assertSuccess(response: AuthResponse): Promise<void> {
  const { error } = await response;
  if (error) throw new Error(error.message);
}

export class AccountAuthService {
  constructor(private readonly auth: AuthClient) {}

  async sendCode(value: string): Promise<void> {
    await assertSuccess(this.auth.signInWithOtp({ email: normalizedEmail(value), options: { shouldCreateUser: true } }));
  }

  async verifyCode(value: string, valueCode: string): Promise<void> {
    const email = normalizedEmail(value);
    const token = valueCode.trim();
    if (!/^\d{6,8}$/.test(token)) throw new Error('请输入 6–8 位验证码');
    await assertSuccess(this.auth.verifyOtp({ email, token, type: 'email' }));
  }

  async signOut(): Promise<void> {
    await assertSuccess(this.auth.signOut({ scope: 'local' }));
  }
}
