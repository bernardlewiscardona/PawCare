import { validateEnv } from './env.validation.js';

const valid = {
  NODE_ENV: 'development',
  PORT: '3000',
  HOST: '0.0.0.0',
  DATABASE_URL: 'postgresql://pawcare:super-secret-pw@localhost:5432/pawcare',
};

describe('validateEnv', () => {
  it('accepts a complete environment and converts types', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('applies defaults for PORT, HOST and NODE_ENV', () => {
    const env = validateEnv({ DATABASE_URL: valid.DATABASE_URL });
    expect(env.PORT).toBe(3000);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.NODE_ENV).toBe('development');
  });

  it('fails with an actionable message naming a missing variable', () => {
    const { DATABASE_URL: _omit, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
    expect(() => validateEnv(rest)).toThrow(/apps\/api\/\.env/);
  });

  it('rejects a DATABASE_URL that is not a postgres URL without echoing its value', () => {
    let message = '';
    try {
      validateEnv({ ...valid, DATABASE_URL: 'mysql://root:hunter2@db/app' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toMatch(/hunter2/);
    expect(message).not.toMatch(/mysql:\/\//);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => validateEnv({ ...valid, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'staging-ish' })).toThrow(/NODE_ENV/);
  });

  it('reports every invalid variable at once', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(
      /PORT[\s\S]*DATABASE_URL|DATABASE_URL[\s\S]*PORT/,
    );
  });
});
