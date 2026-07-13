/** Visual tokens stay replaceable until the owner supplies the final catalogue reference. */
export const DEFAULT_CATALOGUE_THEME = {
  colors: {
    ink: [18, 50, 50] as const,
    muted: [97, 110, 108] as const,
    accent: [181, 139, 67] as const,
    paper: [252, 250, 246] as const,
    rule: [225, 218, 207] as const,
  },
  print: {
    marginMm: 14,
    footerMm: 10,
    bleedMm: 0,
  },
};
