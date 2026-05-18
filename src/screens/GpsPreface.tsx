import { config } from '../config';
import type { HuntAction } from '../state/huntReducer';

type Props = { dispatch: React.Dispatch<HuntAction> };

export default function GpsPreface({ dispatch }: Props) {
  const { gpsPreface } = config;
  return (
    <section className="screen screen--preface">
      <div className="preface__icon" aria-hidden>📍</div>
      <h1 className="screen-title">{gpsPreface.headline}</h1>
      <p className="preface__body">{gpsPreface.body}</p>
      <div className="btn-row">
        <button className="btn-primary" onClick={() => dispatch({ type: 'GRANT_GPS' })}>
          {gpsPreface.allowCta}
        </button>
        <button className="btn-ghost" onClick={() => dispatch({ type: 'DENY_GPS' })}>
          {gpsPreface.denyCta}
        </button>
      </div>
    </section>
  );
}
