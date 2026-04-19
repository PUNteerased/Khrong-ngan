import Image from "next/image"
import logoya from "@img/logoya_bg.png"

type AppLogoProps = {
  className?: string
  /** Pixel width/height (square). */
  size?: number
  priority?: boolean
}

export function AppLogo({ className, size = 40, priority }: AppLogoProps) {
  return (
    <Image
      src={logoya}
      alt="LaneYa"
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  )
}
