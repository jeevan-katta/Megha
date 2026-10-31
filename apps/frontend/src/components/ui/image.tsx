import Image from 'next/image';

// Original asset dimensions reserve space without enlarging the already small WebP files.
function dimensions(src: string): [number, number] {
  if (src === '/assets/hero-machines.webp') return [1600, 800];
  if (src === '/assets/logo.webp') return [588, 324];
  if (src === '/assets/logo-mark.webp') return [588, 235];
  if (src.startsWith('/assets/category-')) return [82, 78];
  if (src.startsWith('/assets/part-')) return [90, 84];
  if (src.startsWith('/assets/machine-')) return [148, 100];
  if (src.startsWith('/assets/service-')) return [158, 74];
  if (src.startsWith('/assets/article-')) return [215, 72];
  return [400, 400];
}

export const Img = ({
  src,
  alt,
  className = '',
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) => {
  const [width, height] = dimensions(src);
  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      priority={priority}
      unoptimized
    />
  );
};
