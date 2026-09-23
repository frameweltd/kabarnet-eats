/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Image optimizer disabled as a precaution — the installed Next.js
    // 14.x line has no patch for a critical AVIF-related RCE (GHSA-2xp9-vwfh-vxw4).
    // This app doesn't accept image uploads yet, so the vulnerable code path
    // isn't reachable, but disabling it removes the risk entirely.
    // TODO: re-enable once upgraded to Next.js 15.5.24+ or 16.3.3+.
    unoptimized: true,
  },
};

export default nextConfig;
