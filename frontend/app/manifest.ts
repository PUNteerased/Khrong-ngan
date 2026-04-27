import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LaneYa",
    short_name: "LaneYa",
    description: "LaneYa medical kiosk web app",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1a365d",
    icons: [
      {
        src: "/logoya_bg.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/logoya_bg.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}

