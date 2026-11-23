import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'pawcare:isPublic';

/** Marks a controller or route as reachable without an owner identity (e.g. health checks). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
