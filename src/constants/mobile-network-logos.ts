import type { MobileNetwork } from '@mori-pay/contracts';

import { resolveMobileNetwork } from '@mori-pay/contracts';

export const MOBILE_NETWORK_LOGOS: Record<MobileNetwork, number> = {
  Mpesa: require('../../assets/images/M-PESA logo vector (svg, pdf) free download - Brandlogos_net.jpg'),
  AirtelMoney: require('../../assets/images/airtellmoney.jpg'),
  TigoPesa: require('../../assets/images/mixx by yas.jpg'),
  HaloPesa: require('../../assets/images/halopesa.jpg'),
};

export function mobileNetworkLogo(network?: string | null): number | undefined {
  const resolved = resolveMobileNetwork(network);
  return resolved ? MOBILE_NETWORK_LOGOS[resolved] : undefined;
}
