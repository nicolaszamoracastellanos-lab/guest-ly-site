import React from "react";
import { CoupleAlbumScreen } from "@/features/album/screens/CoupleAlbum";
import { useTenantKey } from "@/lib/session";

// Keyed by the wedding: a switch never shows the previous wedding's photos.
export default function CoupleAlbumRoute() {
  return <CoupleAlbumScreen key={useTenantKey()} />;
}
