const FALLBACK_PHOTO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#4A3B42"/>
  <circle cx="300" cy="260" r="110" fill="#F8BBD0"/>
  <path d="M120 690c30-165 135-245 180-245s150 80 180 245" fill="#F06292"/>
</svg>`;

export const FALLBACK_PHOTO_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(FALLBACK_PHOTO_SVG)}`;

export const optimizeImageUrl = (url: string | null | undefined, width = 960, quality = 70) => {
  if (!url) {
    return FALLBACK_PHOTO_URL;
  }

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname === 'images.unsplash.com') {
      parsedUrl.searchParams.set('auto', 'format');
      parsedUrl.searchParams.set('fit', 'crop');
      parsedUrl.searchParams.set('w', String(width));
      parsedUrl.searchParams.set('q', String(quality));
      return parsedUrl.toString();
    }

    return url;
  } catch {
    return url;
  }
};

export const imageSrcSet = (url: string | null | undefined, widths = [320, 640, 960, 1280]) =>
  widths.map((width) => `${optimizeImageUrl(url, width)} ${width}w`).join(', ');
