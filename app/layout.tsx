import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '银映 AI 拍摄方案工作台',
  description: '面向银发视听内容的 AIGC 拍摄方案生成与适老化审核演示系统',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
