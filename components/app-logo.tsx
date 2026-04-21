import Image from "next/image"

type AppLogoProps = {
  className?: string
  /** Pixel width/height (square). */
  size?: number
  priority?: boolean
  /** Override source path for special cases. */
  src?: string
}

export function AppLogo({
  className,
  size = 40,
  priority,
  src = "/logoya_bg.png",
}: AppLogoProps) {
  return (
    <Image
      src={src}
      alt="LaneYa"
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  )
}
