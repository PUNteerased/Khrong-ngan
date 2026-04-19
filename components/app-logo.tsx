import Image from "next/image"

type AppLogoProps = {
  className?: string
  /** Pixel width/height (square). */
  size?: number
  priority?: boolean
}

export function AppLogo({ className, size = 40, priority }: AppLogoProps) {
  return (
    <Image
      src="/logoya_bg.png"
      alt="LaneYa"
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  )
}
