import { useEffect } from 'react';
import { config } from '../config';
import { tpl } from '../lib/tpl';
import type { CheckpointIndex, HuntAction } from '../state/huntReducer';

type Props = {
  dispatch: React.Dispatch<HuntAction>;
  afterN: CheckpointIndex;
};

export default function PhotoInterstitial({ dispatch, afterN }: Props) {
  const photo = config.photos.find((p) => p.afterStep === afterN);

  // No photo configured for this slot — auto-advance immediately.
  useEffect(() => {
    if (!photo) {
      dispatch({ type: 'PHOTO_DONE', afterN });
    }
  }, [photo, afterN, dispatch]);

  // Auto-advance timer if a photo IS configured.
  useEffect(() => {
    if (!photo) return;
    const ms = photo.durationMs ?? 8000;
    const t = setTimeout(() => dispatch({ type: 'PHOTO_DONE', afterN }), ms);
    return () => clearTimeout(t);
  }, [photo, afterN, dispatch]);

  if (!photo) return null;

  return (
    <section
      className="screen screen--photo"
      onClick={() => dispatch({ type: 'PHOTO_DONE', afterN })}
    >
      <div className="polaroid">
        <img src={photo.src} alt="" />
        <p className="polaroid__caption">{tpl(photo.caption)}</p>
      </div>
      <p className="fine-print">tap anywhere to continue</p>
    </section>
  );
}
