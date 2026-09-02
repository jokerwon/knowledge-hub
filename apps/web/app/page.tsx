import { redirect } from "next/navigation";

// 知识库目前只有一块真实内容（文档管理），首页直接让位。
export default function Home() {
  redirect("/documents");
}
