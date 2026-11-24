import type { ReactNode } from "react";

/** A plain content page in the night glow style: a dark band with the title, then the content. */
export function PageShell({ title, intro, wide = false, children }: { title: string; intro?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className="gp">
      <header className="top">
        <h1 className="d">{title}</h1>
        {intro && <p>{intro}</p>}
      </header>
      <div className={`body${wide ? " wide" : ""}`}>{children}</div>
    </div>
  );
}

/** Marks a legal page as a draft until the business has checked it. */
export function DraftNote() {
  return (
    <p className="note">
      <b>Draft.</b> This page is a plain-language draft for review. Check every line, and the business details, before the site goes live.
    </p>
  );
}
