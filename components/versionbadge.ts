import { getAppVersionLabel } from '@/lib/version';

export function VersionBadge() {
  const version = getAppVersionLabel();

  return <p className="version-badge">{version}</p>;
}
