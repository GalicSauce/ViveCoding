export const metadata = {
  title: "GREENers Carbon",
  description: "중온 아스팔트 외부사업 온실가스 감축량 산정 및 모니터링"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
