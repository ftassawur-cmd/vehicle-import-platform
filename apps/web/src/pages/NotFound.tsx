import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks";

export default function NotFound() {
  usePageMeta("Page not found — JSL Imports");
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-start px-5 pb-32 pt-40">
      <p className="eyebrow">HTTP 404</p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">
        This route isn't on the manifest.
      </h1>
      <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-mute">
        The page you're after doesn't exist. The calculator does, and it's one click away.
      </p>
      <Link to="/" className="btn-primary mt-8">Back to the overview</Link>
    </section>
  );
}
