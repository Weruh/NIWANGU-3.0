export const BrandLogo = ({
  className = "h-10 w-10",
}: {
  className?: string;
}) => (
  <img
    src="/niwangu-logo.png"
    alt="Niwangu"
    width={64}
    height={64}
    className={`${className} object-contain shrink-0 rounded-full`}
  />
);
