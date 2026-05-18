import { useEffect, useState } from 'react';
import { config } from '../config';
import { tpl } from '../lib/tpl';
import { tierFromDistance, useGeoWatch } from '../geo/useGeoWatch';
import WarmthPulse from '../components/WarmthPulse';
import StuckSheet from '../components/StuckSheet';
import type { CheckpointIndex, HuntAction } from '../state/huntReducer';

type Props = {
  dispatch: React.Dispatch<HuntAction>;
  n: CheckpointIndex;
};

export default function LocationActive({ dispatch, n }: Props) {
  const cp = config.checkpoints[n];
  const { status, distanceMeters, accuracyMeters } = useGeoWatch({
    lat: cp.lat,
    lng: cp.lng,
  });
  const tier = tierFromDistance(distanceMeters);
  const [stuckOpen, setStuckOpen] = useState(false);

  // Auto-unlock when within radius AND we have a decent fix.
  // We require accuracy < 100m to avoid false positives from coarse fallback fixes.
  useEffect(() => {
    if (status !== 'watching') return;
    if (distanceMeters == null) return;
    if (distanceMeters > cp.radiusMeters) return;
    if (accuracyMeters != null && accuracyMeters > 100) return;
    dispatch({ type: 'UNLOCK_CHECKPOINT', n });
  }, [status, distanceMeters, accuracyMeters, cp.radiusMeters, n, dispatch]);

  return (
    <section className="screen screen--location">
      <p className="eyebrow">stop {n + 1} of 3</p>
      <h1 className="location__teaser">{tpl(cp.teaser)}</h1>

      <WarmthPulse status={status} tier={tier} />

      <button className="btn-ghost" onClick={() => setStuckOpen(true)}>
        {config.stuckSheet.title}
      </button>

      <button className="dev-skip" onClick={() => dispatch({ type: 'UNLOCK_CHECKPOINT', n })}>
        (dev) simulate unlock →
      </button>

      <StuckSheet
        open={stuckOpen}
        n={n}
        onClose={() => setStuckOpen(false)}
        onCodeAccepted={() => {
          setStuckOpen(false);
          dispatch({ type: 'UNLOCK_CHECKPOINT', n });
        }}
      />
    </section>
  );
}
