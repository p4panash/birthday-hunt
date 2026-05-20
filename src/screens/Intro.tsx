import { config } from '../config';
import { tpl } from '../lib/tpl';
import CountdownBanner from '../components/CountdownBanner';
import type { HuntAction } from '../state/huntReducer';

type Props = { dispatch: React.Dispatch<HuntAction> };

export default function Intro({ dispatch }: Props) {
  const { intro } = config;
  return (
    <section className="screen screen--intro">
      <div className="intro__top">
        <p className="eyebrow">{intro.eyebrow}</p>
        <h1 className="hero-title">{tpl(intro.headline)}</h1>
        <p className="intro__body">{intro.body}</p>
      </div>
      <CountdownBanner inline />
      <div className="intro__bottom">
        <button className="btn-primary" onClick={() => dispatch({ type: 'START_HUNT' })}>
          {intro.cta}
        </button>
        {intro.finePrint && <p className="fine-print">{intro.finePrint}</p>}
      </div>
    </section>
  );
}
