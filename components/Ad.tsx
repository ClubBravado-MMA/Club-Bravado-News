"use client";

import { useEffect } from "react";

type AdProps = {
  client: string; // e.g., "ca-pub-123..."
  slot: string;   // e.g., "1234567890"
  format?: string;
  fullWidthResponsive?: boolean;
  style?: React.CSSProperties;
  className?: string;
};

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export default function Ad({
  client,
  slot,
  format = "auto",
  fullWidthResponsive = true,
  style,
  className,
}: AdProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (location.hostname === "localhost") {
      // AdSense does not render on localhost
      return;
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // ignore
    }
  }, []);

  return (
    <ins
      className={`adsbygoogle ${className ?? ""}`}
      style={style ?? { display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
    />
  );
}
