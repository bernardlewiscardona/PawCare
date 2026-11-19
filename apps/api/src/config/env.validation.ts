import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsString, Matches, Max, Min, validateSync } from 'class-validator';

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

/**
 * Every environment variable the API reads. Read config through ConfigService<Env, true>;
 * never read process.env elsewhere.
 */
export class Env {
  @IsIn(NODE_ENVS)
  NODE_ENV: NodeEnv = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  HOST: string = '0.0.0.0';

  @Matches(/^postgres(ql)?:\/\/.+/)
  DATABASE_URL!: string;
}

/**
 * Validates process environment at startup. Error messages name the variable and the
 * expected format but never echo the supplied value, which may be a secret.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const env = plainToInstance(Env, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const problems = errors.map((e) => `  - ${e.property}: ${describe(e.property)}`).join('\n');
    throw new Error(
      `Invalid API environment configuration:\n${problems}\n` +
        'Set these in apps/api/.env (copy apps/api/.env.example) or in the process environment.',
    );
  }
  return env;
}

function describe(property: string): string {
  switch (property) {
    case 'NODE_ENV':
      return `must be one of ${NODE_ENVS.join(', ')}`;
    case 'PORT':
      return 'must be an integer between 1 and 65535';
    case 'HOST':
      return 'must be a host or interface address, e.g. 0.0.0.0';
    case 'DATABASE_URL':
      return 'is required and must be a postgresql:// connection string';
    default:
      return 'is invalid';
  }
}
