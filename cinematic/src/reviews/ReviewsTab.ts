/* The Reviews tab's lazy chunk: the one read, the section and the history
   note. Loaded by ./state.ts at idle after hydration, only while
   REVIEWS_ENABLED. */
export { loadReviews } from './client';
export { ReviewsSection } from './ReviewsSection';
export { noteWhere } from './where';
