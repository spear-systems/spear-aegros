import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'aegros:isPublic';

/** Skip API key guard (health checks, static docs). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
