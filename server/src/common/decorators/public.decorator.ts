import { SetMetadata } from '@nestjs/common';

import { IS_PUBLIC_KEY } from '../constants.js';

/** Marks a route as reachable without a valid access token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
