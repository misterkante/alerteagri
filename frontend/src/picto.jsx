// Colour pictograms for people who read little: crops, symptoms, actions, weather.
// Fluent Emoji Flat (MIT, assets/picto/LICENSE) for most of them, drawn in the same style for the
// crops and symptoms emoji do not cover (cotton, cassava, sorghum, cashew, yam, leaf damage).
const FILES = import.meta.glob('./assets/picto/*.svg', { eager: true, query: '?url', import: 'default' });
const URLS = Object.fromEntries(Object.entries(FILES).map(([path, url]) => [path.split('/').pop().replace('.svg', ''), url]));

// Decorative by default: the label next to it carries the meaning for screen readers.
export function Picto({ name, size = 40, className = '', label }) {
  const src = URLS[name] ?? URLS.fiche;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      className={`shrink-0 select-none ${className}`}
      draggable="false"
    />
  );
}

const TINTS = {
  green: 'bg-leaf-light',
  yellow: 'bg-warn-light',
  red: 'bg-danger-light',
  neutral: 'bg-surface-raised',
};

// A pictogram on a soft tinted square: the anchor of a tile or a list row.
export function PictoBadge({ name, tint = 'neutral', size = 48 }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-2xl ${TINTS[tint]}`} style={{ width: size, height: size }}>
      <Picto name={name} size={Math.round(size * 0.66)} />
    </span>
  );
}
