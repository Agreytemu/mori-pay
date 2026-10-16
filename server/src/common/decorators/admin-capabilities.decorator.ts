import { SetMetadata } from '@nestjs/common';

import type { AdminCapability } from '@mori-pay/contracts';

export const ADMIN_CAPABILITIES_METADATA = 'mori.admin.capabilities';

export function RequireAdminCapabilities(...capabilities: AdminCapability[]) {
  return SetMetadata(ADMIN_CAPABILITIES_METADATA, capabilities);
}
