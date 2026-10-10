import { readCloudConfig } from '../../src/account/cloudConfig';

describe('cloud configuration', () => {
  it('keeps guest mode available when cloud settings are absent', () => {
    expect(readCloudConfig({ url: undefined, publishableKey: undefined })).toBeNull();
  });

  it('rejects an incomplete or insecure endpoint', () => {
    expect(readCloudConfig({ url: 'http://example.com', publishableKey: 'test' })).toBeNull();
    expect(readCloudConfig({ url: 'https://example.com', publishableKey: '' })).toBeNull();
  });

  it('accepts a complete HTTPS endpoint and trims whitespace', () => {
    expect(readCloudConfig({ url: ' https://abc.supabase.co/ ', publishableKey: ' public-key ' })).toEqual({
      url: 'https://abc.supabase.co', publishableKey: 'public-key',
    });
  });

  it('never accepts a server secret in a public app setting', () => {
    expect(readCloudConfig({ url: 'https://abc.supabase.co', publishableKey: 'sb_secret_do-not-ship' })).toBeNull();
  });
});
