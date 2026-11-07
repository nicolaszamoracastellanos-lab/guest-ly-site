import { useEffect, useId } from 'react';
import { useLang } from '../ui/LanguageContext';
import { BrandText } from '../ui/BrandText';
import { useGuidesShown } from '../guides/shown';
import { averageLabel, fill, ldText, monthLabel, starFills, withReviewsLd } from './core';
import type { Reviews } from './core';
import { reviewsCopy } from './copy';
import './reviews.css';

/* The Reviews tab (lazy chunk ./ReviewsTab.ts, only while REVIEWS_ENABLED).
   ./state.ts loads the chunk at idle after hydration, calls loadReviews()
   (./client.ts) once and mounts ReviewsSection only for an answer worth
   showing (core.ts readReviews), at
   a moment when adding it moves nothing on screen. There is no loading or
   empty state on purpose: until then, and for zero reviews or any failure,
   the page has no trace of the tab. */

const STAR = 'M12 2.8l2.84 5.76 6.36.92-4.6 4.49 1.09 6.33L12 17.31l-5.69 2.99 1.09-6.33-4.6-4.49 6.36-.92z';

/* Five stars, each drawn as an outline with its filled part on top, so a
   filled star and an empty one differ in shape, not only in color. Always
   aria-hidden: the rating is in words next to it (or in the label of the
   element around it). */
function Stars({ value }: { value: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <span className="reviews-stars" aria-hidden="true">
      {starFills(value).map((f, i) => (
        <svg key={i} viewBox="0 0 24 24" focusable="false">
          <path d={STAR} className="reviews-star__line" />
          {f >= 1 ? <path d={STAR} className="reviews-star__fill" /> : null}
          {f > 0 && f < 1 ? (
            <>
              <clipPath id={`${uid}-${i}`}>
                <rect width={24 * f} height="24" />
              </clipPath>
              <path d={STAR} className="reviews-star__fill" clipPath={`url(#${uid}-${i})`} />
            </>
          ) : null}
        </svg>
      ))}
    </span>
  );
}

/* Adds the answer's aggregateRating and reviews to the Product JSON-LD block
   while the section is on the page, and puts the block back as built when it
   goes. Nothing else touches it at run time. */
function useReviewsLd(data: Reviews) {
  useEffect(() => {
    const blocks = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
    for (const el of blocks) {
      const built = el.textContent ?? '';
      let product: Record<string, unknown>;
      try {
        product = JSON.parse(built);
      } catch {
        continue;
      }
      if (product['@type'] !== 'Product') continue;
      el.textContent = ldText(withReviewsLd(product, data));
      return () => {
        el.textContent = built;
      };
    }
    return undefined;
  }, [data]);
}

export function ReviewsSection({ data }: { data: Reviews }) {
  const { lang } = useLang();
  const c = reviewsCopy[lang];
  const guidesShown = useGuidesShown();
  useReviewsLd(data);
  const average = averageLabel(data.average, lang);
  const count = data.count === 1 ? c.countOne : fill(c.countMany, { n: data.count });

  return (
    <section id="reviews" className="section reviews">
      <div className="container">
        {/* The shared section header, without its scroll reveal: this section
            arrives after the page's reveal observer has started. */}
        <header className="sec-head">
          <p className="sec-eyebrow">
            <span className="sec-no">{import.meta.env.VITE_GUIDES_ENABLED && guidesShown ? c.noAfterGuides : c.no}</span>
            <span className="sec-rule" aria-hidden="true" />
            <span className="sec-kicker">{c.kicker}</span>
          </p>
          <h2 className="sec-title">
            {c.title.split('\n').map((line, i) => (
              <span key={i}>{line}</span>
            ))}
          </h2>
          <p className="sec-intro">
            <BrandText text={c.intro} />
          </p>
        </header>

        <p className="reviews-score">
          <span className="reviews-score__num">{average}</span>
          <Stars value={data.average} />
          <span className="reviews-score__text">
            {c.score}, {count}
          </span>
        </p>

        <ul className="proof-grid reviews-list">
          {data.reviews.map((r) => {
            const month = monthLabel(r.month, lang);
            return (
              <li key={r.id} className="glass glass-card proof review">
                <figure className="review__figure">
                  <span className="review__rating" role="img" aria-label={fill(c.stars, { n: r.rating })}>
                    <Stars value={r.rating} />
                  </span>
                  <blockquote className="proof__quote review__text">
                    <p>{r.text}</p>
                  </blockquote>
                  <figcaption className="proof__who">
                    <span className="proof__names" translate="no">
                      {r.name}
                    </span>
                    {month ? <span className="proof__place">{fill(c.wedding, { month })}</span> : null}
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>

        {data.count > data.reviews.length ? (
          <p className="reviews-note">{fill(c.newest, { shown: data.reviews.length, n: data.count })}</p>
        ) : null}
      </div>
    </section>
  );
}
