import { useMemo, useState, type ImgHTMLAttributes } from 'react';
import { FALLBACK_PHOTO_URL, imageSrcSet, optimizeImageUrl } from '../lib/images';

type OptimizedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src: string | null | undefined;
  srcWidth?: number;
  srcSetWidths?: number[];
};

export const OptimizedImage = ({
  src,
  srcWidth = 960,
  srcSetWidths,
  sizes = '100vw',
  loading = 'lazy',
  decoding = 'async',
  onError,
  ...props
}: OptimizedImageProps) => {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = failed ? FALLBACK_PHOTO_URL : src;
  const optimizedSrc = useMemo(() => optimizeImageUrl(resolvedSrc, srcWidth), [resolvedSrc, srcWidth]);
  const optimizedSrcSet = useMemo(
    () => (failed ? undefined : imageSrcSet(resolvedSrc, srcSetWidths)),
    [failed, resolvedSrc, srcSetWidths],
  );

  return (
    <img
      {...props}
      src={optimizedSrc}
      srcSet={optimizedSrcSet}
      sizes={sizes}
      loading={loading}
      decoding={decoding}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
};
