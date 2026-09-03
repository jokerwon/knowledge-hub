import { redirect } from "next/navigation";

// 仪表盘（/dashboard）是应用首页;文档管理在 /documents。
export default function Home() {
  redirect("/dashboard");
}
