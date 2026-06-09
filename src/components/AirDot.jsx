export default function AirDot({ color, size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      {/* 외곽 글로우 */}
      <circle cx="18" cy="18" r="16" fill={color} fillOpacity="0.15" />
      {/* 테두리 링 */}
      <circle cx="18" cy="18" r="12" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* 채운 원 */}
      <circle cx="18" cy="18" r="7" fill={color} />
    </svg>
  );
}
