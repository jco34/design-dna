/**
 * Design DNA - the shared schema module.
 *
 * The map locks that the producer CLI and the web app share this module and
 * nothing else. It is the assembled form of four ticket decisions:
 *
 *   004  the extraction contract and the Item record          -> ./dna
 *   005  the closed label taxonomy and the Scope vocabulary   -> ./taxonomy
 *   007  rendering an Item as a copyable design brief         -> ./prompt
 *   010  rendering a Mix of traits as one brief               -> ./mix
 *
 * The ticket assets under `wayfinder/assets/` are the record of how each
 * decision was reached. This directory is the running code, and where the two
 * disagree this one is authoritative. One reconciliation was applied while
 * assembling: 004 shipped a provisional flat `labels` array and explicitly
 * handed the vocabulary to 005, which replaced it with three closed axes and
 * added `taxonomyVersion` to the Item. That replacement is made here.
 */
export * from './dna';
export * from './prompt';

/*
 * `Scope` is deliberately re-exported from `./dna` above rather than from
 * `./taxonomy`, because 005 confirmed 004's enum rather than replacing it and
 * `dna.ts` re-exports the taxonomy's own `ScopeValue`. They are the same runtime
 * value; naming it once keeps the ambiguity out of the barrel.
 */
export {
  TAXONOMY_VERSION,
  GENRES,
  GENRE_GLOSS,
  STYLES,
  STYLE_GLOSS,
  MOODS,
  MOOD_GLOSS,
  SCOPES,
  SCOPE_GLOSS,
  NOT_APPLICABLE_BY_SCOPE,
  notApplicableFor,
  GenreValue,
  StyleValue,
  MoodValue,
  ScopeValue,
  MAX_STYLES,
  MAX_MOODS,
  LabelAuthorship,
  ExtractedLabels,
  Labels,
  AXES,
  ItemTaxonomyFields,
  isStale,
  stampLabelAuthorship,
  isRelabelable,
  LABELS_JSON_SCHEMA,
} from './taxonomy';
export type { Genre, Style, Mood, Axis } from './taxonomy';
