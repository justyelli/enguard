import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Enguard — изучение английского",
    short_name: "Enguard",
    description:
      "Чтение книг с переводом по клику, умный переводчик, карточки и воркбук.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#4f46e5",
    lang: "ru",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
